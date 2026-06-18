import type { RiskAssessment } from "./types";
import type { OrderContext } from "./types";
import {
  evaluateAllocationCheck,
  evaluateCashReserveCheck,
  evaluateOrderSizeCheck,
} from "./checks";
import { evaluateDrawdown } from "./drawdown";
import { evaluateLossLimits } from "./lossLimits";

export function evaluateOrder(context: OrderContext): RiskAssessment {
  const reasons: string[] = [];
  const warnings: string[] = [];
  let allowedAmount = context.orderAmount;

  if (context.killSwitchActive) {
    return {
      level: "BLACK",
      reasons: ["Kill switch attivo."],
      warnings: [],
      blocked: true,
      allowedAmount: 0,
    };
  }

  if (!context.tradingAllowed) {
    return {
      level: "RED",
      reasons: [context.tradingMessage],
      warnings: [],
      blocked: true,
      allowedAmount: 0,
    };
  }

  if (!context.journalValid) {
    reasons.push(...context.journalReasons);
  }

  warnings.push(...context.journalWarnings);

  const lossCheck = evaluateLossLimits({
    dailyLossPct: context.dailyLossPct,
    monthlyLossPct: context.monthlyLossPct,
    maxDailyLossPct: context.maxDailyLossPct,
    maxMonthlyLossPct: context.maxMonthlyLossPct,
  });
  warnings.push(...lossCheck.warnings);

  if (context.side === "BUY" && lossCheck.blockBuy) {
    reasons.push(...lossCheck.reasons);
    allowedAmount = 0;
  }

  const drawdownCheck = evaluateDrawdown({
    drawdownPct: context.currentDrawdownPct,
    maxDrawdownPct: context.maxDrawdownPct,
  });
  warnings.push(...drawdownCheck.warnings);

  if (context.side === "BUY" && drawdownCheck.blockBuy) {
    reasons.push(...drawdownCheck.reasons);
    allowedAmount = 0;
  }

  const orderSizeCheck = evaluateOrderSizeCheck(context);
  reasons.push(...orderSizeCheck.reasons);
  if (context.side === "BUY" && context.orderAmount > context.maxOrderAmount) {
    allowedAmount = Math.min(allowedAmount, context.maxOrderAmount);
  }
  if (context.dailyOrderCount >= context.maxDailyOrders) {
    allowedAmount = 0;
  }

  const cashCheck = evaluateCashReserveCheck(context);
  reasons.push(...cashCheck.reasons);
  if (context.side === "BUY" && context.orderAmount > context.cashBalance) {
    allowedAmount = Math.min(allowedAmount, context.cashBalance);
  }
  if (
    context.side === "BUY" &&
    context.bucket === "SPECULATIVE" &&
    context.orderAmount > context.experimentalCashBalance
  ) {
    allowedAmount = Math.min(allowedAmount, context.experimentalCashBalance);
  }
  if (
    context.side === "BUY" &&
    context.bucket === "SPECULATIVE" &&
    context.experimentalCapital > 0 &&
    context.currentExperimentalBudgetTotal > context.experimentalCapital
  ) {
    allowedAmount = 0;
  }
  if (context.side === "BUY" && context.bucket !== "SPECULATIVE") {
    const cashAfter = context.cashBalance - context.orderAmount;
    if (cashAfter < context.minCashReserve) {
      allowedAmount = Math.min(
        allowedAmount,
        Math.max(0, context.cashBalance - context.minCashReserve),
      );
    }
  }

  const allocationCheck = evaluateAllocationCheck(context);
  reasons.push(...allocationCheck.reasons);

  const projectedPositionValue =
    context.side === "BUY"
      ? context.currentPositionValue + context.orderAmount
      : Math.max(0, context.currentPositionValue - context.orderAmount);

  const totalPortfolio =
    context.cashBalance +
    context.currentPositionValue +
    (context.side === "BUY" ? 0 : context.orderAmount);

  const projectedPositionPct =
    totalPortfolio > 0 ? (projectedPositionValue / totalPortfolio) * 100 : 0;

  if (context.orderUsesLeverage && !context.leverageAllowed) {
    reasons.push("Leva finanziaria non consentita dalle impostazioni.");
    allowedAmount = 0;
  }

  warnings.push(
    ...context.pumpWarnings,
    ...context.volatilityWarnings,
    ...context.concentrationWarnings,
    ...context.revengeWarnings,
  );
  reasons.push(
    ...context.pumpReasons,
    ...context.volatilityReasons,
    ...context.concentrationReasons,
    ...context.revengeReasons,
  );

  const hasHardBlock = reasons.some(
    (r) =>
      r.includes("Kill switch") ||
      r.includes("Journal") ||
      r.includes("supera il limite") ||
      r.includes("insufficiente") ||
      r.includes("giornalieri") ||
      r.includes("riserva minima") ||
      r.includes("Perdita giornaliera") ||
      r.includes("Perdita mensile") ||
      r.includes("Drawdown corrente") ||
      r.includes("fuori orario") ||
      r.includes("Trading bloccato") ||
      r.includes("Emotion score elevato") ||
      r.includes("Journal incompleto") ||
      r.includes("Leva finanziaria") ||
      r.includes("revenge trading") ||
      r.includes("forte rialzo") ||
      r.includes("Volatilità asset elevata") ||
      r.includes("singola crypto") ||
      r.includes("Prezzo stale") ||
      r.includes("Prezzo mancante") ||
      r.includes("Cooldown attivo") ||
      r.includes("Averaging down"),
  );

  allowedAmount = Math.max(0, Math.min(allowedAmount, context.orderAmount));

  const levelPriority = {
    GREEN: 1,
    YELLOW: 2,
    ORANGE: 3,
    RED: 4,
    BLACK: 5,
  };

  function applyJournalFloor(level: RiskAssessment["level"]): RiskAssessment["level"] {
    if (context.journalLevel === "YELLOW") {
      return levelPriority[level] < levelPriority.ORANGE ? "ORANGE" : level;
    }
    return level;
  }

  if (hasHardBlock || !context.journalValid) {
    return {
      level: "RED",
      reasons,
      warnings,
      blocked: true,
      allowedAmount,
    };
  }

  const nearBucketLimit =
    context.projectedBucketPct > context.maxBucketPct * 0.8;
  const nearPositionLimit =
    projectedPositionPct > context.maxPositionPct * 0.8;
  const nearCryptoLimit =
    context.assetType === "CRYPTO" &&
    context.projectedCryptoPct > context.maxCryptoPct * 0.8;
  const nearExperimentalLimit =
    context.bucket === "SPECULATIVE" &&
    context.projectedExperimentalPct > context.maxExperimentalPct * 0.8;

  if (
    nearBucketLimit ||
    nearPositionLimit ||
    nearCryptoLimit ||
    nearExperimentalLimit ||
    lossCheck.warnings.length > 0 ||
    drawdownCheck.warnings.length > 0
  ) {
    warnings.push("Esposizione vicina ai limiti di rischio.");
    return {
      level: applyJournalFloor("ORANGE"),
      reasons,
      warnings,
      blocked: false,
      allowedAmount,
    };
  }

  if (context.orderAmount > context.maxOrderAmount * 0.5) {
    warnings.push("Ordine di importo significativo: procedi con cautela.");
    return {
      level: applyJournalFloor("YELLOW"),
      reasons,
      warnings,
      blocked: false,
      allowedAmount,
    };
  }

  return {
    level: applyJournalFloor("GREEN"),
    reasons:
      reasons.length > 0 ? reasons : ["Ordine entro i limiti di rischio."],
    warnings,
    blocked: false,
    allowedAmount,
  };
}
