import type { AssetType, Bucket, UserSettings } from "@prisma/client";
import type { TradeJournal } from "@prisma/client";
import { prisma } from "@/lib/db";
import { resolvePrice } from "@/lib/prices/resolve";
import { validateJournalForOrder } from "@/lib/security";
import {
  evaluateAveragingDownCheck,
  evaluateRejectedCooldownCheck,
  evaluateStalePriceCheck,
} from "./checks";
import type { RiskBaselineMetrics } from "./baselines";
import { evaluateConcentration } from "./concentration";
import { evaluatePortfolio } from "./evaluatePortfolio";
import { evaluateOrder } from "./evaluateOrder";
import { evaluateDrawdown } from "./drawdown";
import { evaluateLossLimits } from "./lossLimits";
import { computePriceChangePct, evaluateAssetPump } from "./pump";
import { evaluateRevengeTrading } from "./revenge";
import { isWithinTradingWindow } from "./tradingHours";
import type { RiskAssessment } from "./types";
import { computeAssetVolatilityPct, evaluateVolatility } from "./volatility";

export async function evaluateRiskGate(input: {
  settings: UserSettings;
  journal: TradeJournal | null;
  riskMetrics: RiskBaselineMetrics;
  order: {
    assetId: string;
    symbol: string;
    side: "BUY" | "SELL";
    quantity: number;
    limitPrice: number;
    bucket: Bucket;
    assetType: AssetType;
    usesLeverage?: boolean;
  };
  positions: Array<{
    assetId: string;
    symbol: string;
    quantity: number;
    avgPrice: number;
    currentPrice?: number;
    bucket: Bucket;
    assetType: AssetType;
  }>;
  dailyOrderCount: number;
}): Promise<RiskAssessment> {
  if (input.settings.killSwitchActive) {
    return {
      level: "BLACK",
      reasons: ["Kill switch attivo: tutte le operazioni sono bloccate."],
      warnings: [],
      blocked: true,
      allowedAmount: 0,
    };
  }

  const asset = await prisma.asset.findUniqueOrThrow({
    where: { id: input.order.assetId },
  });
  const resolvedPrice = await resolvePrice(asset);
  const cooldownCheck = await evaluateRejectedCooldownCheck(
    input.settings.rejectedOrderCooldownMinutes,
  );
  const staleCheck = evaluateStalePriceCheck({
    side: input.order.side,
    priceStatus: resolvedPrice.status,
    symbol: input.order.symbol,
  });
  const existingPosition = input.positions.find(
    (p) => p.assetId === input.order.assetId,
  );
  const averagingCheck = evaluateAveragingDownCheck({
    side: input.order.side,
    rejectAveragingDown: input.settings.rejectAveragingDown,
    limitPrice: input.order.limitPrice,
    positionAvgPrice: existingPosition?.avgPrice,
    hasPosition: (existingPosition?.quantity ?? 0) > 0,
  });

  if (staleCheck.block || cooldownCheck.block || averagingCheck.block) {
    return {
      level: "RED",
      reasons: [
        ...staleCheck.reasons,
        ...cooldownCheck.reasons,
        ...averagingCheck.reasons,
      ],
      warnings: [...staleCheck.warnings, ...cooldownCheck.warnings],
      blocked: true,
      allowedAmount: 0,
    };
  }

  const portfolio = evaluatePortfolio({
    cashBalance: input.settings.cashBalance,
    experimentalCashBalance: input.settings.experimentalCashBalance,
    positions: input.positions,
  });

  const currentPosition = portfolio.positionValues.find(
    (p) => p.assetId === input.order.assetId,
  );
  const currentPositionValue = currentPosition?.value ?? 0;
  const orderAmount = input.order.quantity * input.order.limitPrice;

  const bucketValueAfter =
    portfolio.bucketValues[input.order.bucket] +
    (input.order.side === "BUY" ? orderAmount : -orderAmount);

  const projectedBucketPct =
    portfolio.totalValue > 0
      ? (Math.max(0, bucketValueAfter) / portfolio.totalValue) * 100
      : 0;

  const cryptoDelta =
    input.order.assetType === "CRYPTO"
      ? input.order.side === "BUY"
        ? orderAmount
        : -orderAmount
      : 0;
  const projectedCryptoValue = Math.max(0, portfolio.cryptoValue + cryptoDelta);
  const projectedCryptoPct =
    portfolio.totalValue > 0
      ? (projectedCryptoValue / portfolio.totalValue) * 100
      : 0;

  const currentCryptoPosition = portfolio.positionValues.find(
    (p) => p.assetId === input.order.assetId && p.assetType === "CRYPTO",
  );
  const currentSingleCryptoValue =
    input.order.assetType === "CRYPTO" ? (currentCryptoPosition?.value ?? 0) : 0;
  const projectedSingleCryptoValue =
    input.order.assetType === "CRYPTO"
      ? input.order.side === "BUY"
        ? currentSingleCryptoValue + orderAmount
        : Math.max(0, currentSingleCryptoValue - orderAmount)
      : 0;
  const projectedSingleCryptoPct =
    portfolio.totalValue > 0
      ? (projectedSingleCryptoValue / portfolio.totalValue) * 100
      : 0;

  const experimentalDelta =
    input.order.bucket === "SPECULATIVE"
      ? input.order.side === "BUY"
        ? orderAmount
        : -orderAmount
      : 0;
  const currentExperimentalValue = portfolio.bucketValues.SPECULATIVE;
  const projectedExperimentalValue = Math.max(
    0,
    currentExperimentalValue + experimentalDelta,
  );
  const projectedExperimentalPct =
    portfolio.totalValue > 0
      ? (projectedExperimentalValue / portfolio.totalValue) * 100
      : 0;

  const tradingWindow = isWithinTradingWindow(input.settings);
  const journalCheck = validateJournalForOrder(input.journal);

  const [priceChangePct, volatilityPct] = await Promise.all([
    computePriceChangePct(
      input.order.assetId,
      input.settings.assetPumpLookbackDays,
    ),
    computeAssetVolatilityPct(input.order.assetId),
  ]);

  const pumpCheck = evaluateAssetPump({
    priceChangePct,
    maxPumpPct: input.settings.maxAssetPumpPct,
    lookbackDays: input.settings.assetPumpLookbackDays,
  });

  const volatilityCheck = evaluateVolatility({
    volatilityPct,
    maxVolatilityPct: input.settings.maxAssetVolatilityPct,
  });

  const concentrationCheck = evaluateConcentration({
    positions: portfolio.positionValues.map((p) => ({
      symbol: p.symbol,
      assetType: p.assetType,
      bucket: p.bucket,
      value: p.value,
    })),
    orderSymbol: input.order.symbol,
    orderAssetType: input.order.assetType,
    orderBucket: input.order.bucket,
    orderValue: orderAmount,
    totalPortfolioValue: portfolio.totalValue,
  });

  const revengeCheck = evaluateRevengeTrading({
    side: input.order.side,
    dailyLossPct: input.riskMetrics.daily.lossPct,
    revengeTradingLossPct: input.settings.revengeTradingLossPct,
  });

  const experimentalInvested = portfolio.bucketValues.SPECULATIVE;
  const currentExperimentalBudgetTotal =
    input.settings.experimentalCashBalance + experimentalInvested;

  const spendableCash =
    input.order.bucket === "SPECULATIVE" && input.order.side === "BUY"
      ? input.settings.experimentalCashBalance
      : input.settings.cashBalance;

  return evaluateOrder({
    assetId: input.order.assetId,
    symbol: input.order.symbol,
    side: input.order.side,
    quantity: input.order.quantity,
    limitPrice: input.order.limitPrice,
    orderAmount,
    bucket: input.order.bucket,
    assetType: input.order.assetType,
    journalValid: journalCheck.valid,
    journalReasons: journalCheck.reasons,
    journalLevel: journalCheck.level,
    journalQualityScore: journalCheck.qualityScore,
    journalWarnings: journalCheck.warnings,
    killSwitchActive: input.settings.killSwitchActive,
    maxOrderAmount: input.settings.maxOrderAmount,
    maxPositionPct: input.settings.maxPositionPct,
    maxBucketPct: input.settings.maxBucketPct,
    minCashReserve: input.settings.minCashReserve,
    maxCryptoPct: input.settings.maxCryptoPct,
    dailyOrderCount: input.dailyOrderCount,
    maxDailyOrders: input.settings.maxDailyOrders,
    cashBalance: spendableCash,
    currentPositionValue,
    currentPositionPct: currentPosition?.pct ?? 0,
    projectedBucketPct,
    currentCryptoPct: portfolio.cryptoPct,
    projectedCryptoPct,
    maxDailyLossPct: input.settings.maxDailyLossPct,
    maxMonthlyLossPct: input.settings.maxMonthlyLossPct,
    maxExperimentalPct: input.settings.maxExperimentalPct,
    maxDrawdownPct: input.settings.maxDrawdownPct,
    dailyLossPct: input.riskMetrics.daily.lossPct,
    monthlyLossPct: input.riskMetrics.monthly.lossPct,
    currentDrawdownPct: input.riskMetrics.drawdown.drawdownPct,
    projectedExperimentalPct,
    currentExperimentalPct: portfolio.bucketPcts.SPECULATIVE,
    tradingAllowed: tradingWindow.allowed,
    tradingMessage: tradingWindow.message,
    maxSingleCryptoPct: input.settings.maxSingleCryptoPct,
    leverageAllowed: input.settings.leverageAllowed,
    orderUsesLeverage: input.order.usesLeverage ?? false,
    projectedSingleCryptoPct,
    pumpWarnings: pumpCheck.warnings,
    pumpReasons: pumpCheck.reasons,
    volatilityWarnings: volatilityCheck.warnings,
    volatilityReasons: volatilityCheck.reasons,
    concentrationWarnings: concentrationCheck.warnings,
    concentrationReasons: concentrationCheck.reasons,
    revengeWarnings: revengeCheck.warnings,
    revengeReasons: revengeCheck.reasons,
    experimentalCashBalance: input.settings.experimentalCashBalance,
    experimentalCapital: input.settings.experimentalCapital,
    currentExperimentalBudgetTotal,
  });
}

export function getPortfolioRiskLevel(
  bucketPcts: Record<Bucket, number>,
  maxBucketPct: number,
): RiskAssessment {
  const maxBucket = Math.max(...Object.values(bucketPcts));
  if (maxBucket > maxBucketPct) {
    return {
      level: "RED",
      reasons: [
        `Allocazione massima bucket (${maxBucket.toFixed(1)}%) oltre il limite.`,
      ],
      warnings: [],
      blocked: true,
      allowedAmount: 0,
    };
  }
  if (maxBucket > maxBucketPct * 0.85) {
    return {
      level: "ORANGE",
      reasons: ["Allocazione bucket vicina al limite."],
      warnings: [],
      blocked: false,
      allowedAmount: 0,
    };
  }
  if (maxBucket > maxBucketPct * 0.7) {
    return {
      level: "YELLOW",
      reasons: ["Portafoglio moderatamente concentrato."],
      warnings: [],
      blocked: false,
      allowedAmount: 0,
    };
  }
  return {
    level: "GREEN",
    reasons: ["Rischio complessivo entro i limiti."],
    warnings: [],
    blocked: false,
    allowedAmount: 0,
  };
}

export function getPortfolioRiskSummary(input: {
  bucketPcts: Record<Bucket, number>;
  maxBucketPct: number;
  riskMetrics: RiskBaselineMetrics;
  settings: Pick<
    UserSettings,
    | "maxDailyLossPct"
    | "maxMonthlyLossPct"
    | "maxDrawdownPct"
    | "tradingWindowEnabled"
    | "tradingStartHour"
    | "tradingEndHour"
    | "tradingTimezone"
  >;
}): RiskAssessment {
  const base = getPortfolioRiskLevel(
    input.bucketPcts,
    input.maxBucketPct,
  );

  const lossCheck = evaluateLossLimits({
    dailyLossPct: input.riskMetrics.daily.lossPct,
    monthlyLossPct: input.riskMetrics.monthly.lossPct,
    maxDailyLossPct: input.settings.maxDailyLossPct,
    maxMonthlyLossPct: input.settings.maxMonthlyLossPct,
  });

  const drawdownCheck = evaluateDrawdown({
    drawdownPct: input.riskMetrics.drawdown.drawdownPct,
    maxDrawdownPct: input.settings.maxDrawdownPct,
  });

  const tradingWindow = isWithinTradingWindow(input.settings);
  const reasons = [...base.reasons];
  const warnings = [...base.warnings, ...lossCheck.warnings, ...drawdownCheck.warnings];

  if (lossCheck.blockBuy) {
    reasons.push(...lossCheck.reasons);
  }
  if (drawdownCheck.blockBuy) {
    reasons.push(...drawdownCheck.reasons);
  }
  if (!tradingWindow.allowed) {
    reasons.push(tradingWindow.message);
  }

  const levelPriority = { BLACK: 5, RED: 4, ORANGE: 3, YELLOW: 2, GREEN: 1 };
  let level = base.level;

  if (!tradingWindow.allowed || lossCheck.blockBuy || drawdownCheck.blockBuy) {
    level = "RED";
  } else if (
    lossCheck.warnings.length > 0 ||
    drawdownCheck.warnings.length > 0
  ) {
    level =
      levelPriority[level] < levelPriority.ORANGE ? "ORANGE" : level;
  }

  return {
    level,
    reasons: reasons.length > 0 ? reasons : base.reasons,
    warnings,
    blocked: level === "RED" || level === "BLACK",
    allowedAmount: 0,
  };
}