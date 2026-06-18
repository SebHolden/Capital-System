import type { ExecutionMode } from "@prisma/client";
import { getBroker } from "@/lib/brokers";
import { prisma } from "@/lib/db";
import { getPositionsWithMarketPrices } from "@/lib/portfolio";
import { effectivePrice, resolvePrice } from "@/lib/prices";
import { evaluateRiskGate, simulateOrderImpact, syncRiskBaselines } from "@/lib/risk";
import type { OrderImpact, RiskAssessment } from "@/lib/risk/types";
import {
  getUserSettings,
  validateJournalForOrder,
  writeAuditLog,
} from "@/lib/security";
import {
  assertIdempotencyKey,
  findExistingExecution,
} from "./idempotency";
import { checkExecutionRateLimit } from "./rateLimit";
import { assertLiveExecutionAllowed } from "./liveGate";

export {
  LiveNotEnabledError,
  LivePassphraseError,
  LiveLimitError,
  LivePrerequisiteError,
} from "./liveGate";

export interface SimulateOrderInput {
  assetId: string;
  side: "BUY" | "SELL";
  quantity: number;
  limitPrice?: number;
  journalId?: string;
}

export interface ExecuteOrderInput extends SimulateOrderInput {
  journalId: string;
  idempotencyKey: string;
  confirmRisk: true;
  mode?: "MOCK" | "PAPER" | "LIVE";
  confirmLive?: true;
  livePassphrase?: string;
}

export interface ExecutionResponse {
  orderIntentId?: string;
  idempotentReplay?: boolean;
  riskDecision: {
    level: string;
    reasons: string[];
    warnings: string[];
    blocked: boolean;
    allowedAmount: number;
    journalQualityScore?: number;
    journalLevel?: string;
    journalWarnings?: string[];
  };
  impact?: OrderImpact;
  execution?: {
    success: boolean;
    fillPrice: number | null;
    message: string;
    brokerOrderId?: string;
  };
}

function mapPositions(
  positions: Awaited<ReturnType<typeof getPositionsWithMarketPrices>>,
) {
  return positions.map((p) => ({
    assetId: p.assetId,
    symbol: p.asset.symbol,
    quantity: p.quantity,
    avgPrice: p.avgPrice,
    currentPrice: p.marketPrice,
    bucket: p.bucket,
    assetType: p.asset.assetType as import("@prisma/client").AssetType,
  }));
}

async function getDailyOrderCount(): Promise<number> {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  return prisma.orderIntent.count({
    where: { createdAt: { gte: startOfDay } },
  });
}

async function buildRiskContext(input: SimulateOrderInput) {
  const settings = await getUserSettings();
  const asset = await prisma.asset.findUniqueOrThrow({
    where: { id: input.assetId },
  });
  const positions = await getPositionsWithMarketPrices();
  const mappedPositions = mapPositions(positions);
  const journal = input.journalId
    ? await prisma.tradeJournal.findUnique({ where: { id: input.journalId } })
    : null;
  const journalValidation = validateJournalForOrder(journal);

  const resolved = await resolvePrice(asset);
  const defaultPrice = effectivePrice(resolved);

  const limitPrice =
    input.limitPrice ??
    positions.find((p) => p.assetId === input.assetId)?.marketPrice ??
    defaultPrice ??
    0;

  const portfolioValue =
    settings.cashBalance +
    mappedPositions.reduce(
      (sum, p) => sum + p.quantity * (p.currentPrice ?? p.avgPrice),
      0,
    );

  const { settings: syncedSettings, metrics: riskMetrics } =
    await syncRiskBaselines(settings, portfolioValue);

  const dailyOrderCount = await getDailyOrderCount();

  const assessment = await evaluateRiskGate({
    settings: syncedSettings,
    journal,
    riskMetrics,
    order: {
      assetId: asset.id,
      symbol: asset.symbol,
      side: input.side,
      quantity: input.quantity,
      limitPrice,
      bucket: asset.bucket,
      assetType: asset.assetType,
    },
    positions: mappedPositions,
    dailyOrderCount,
  });

  const impact = simulateOrderImpact({
    cashBalance: syncedSettings.cashBalance,
    positions: mappedPositions,
    order: {
      assetId: asset.id,
      side: input.side,
      quantity: input.quantity,
      limitPrice,
      bucket: asset.bucket,
      assetType: asset.assetType,
    },
  });

  return {
    settings: syncedSettings,
    asset,
    journal,
    journalValidation,
    limitPrice,
    assessment,
    impact,
    riskMetrics,
  };
}

function applyAllowedAmountCheck(
  assessment: RiskAssessment,
  orderAmount: number,
): RiskAssessment {
  if (orderAmount <= 0) return assessment;

  const tolerance = 0.01;
  if (orderAmount <= assessment.allowedAmount + tolerance) {
    return assessment;
  }

  const excessReason = `Importo ordine (€${orderAmount.toFixed(2)}) supera il massimo consentito (€${assessment.allowedAmount.toFixed(2)}).`;
  const reasons = assessment.reasons.includes(excessReason)
    ? assessment.reasons
    : [...assessment.reasons, excessReason];

  return {
    ...assessment,
    reasons,
    blocked: true,
    level: assessment.level === "BLACK" ? "BLACK" : "RED",
  };
}

function formatRiskResponse(
  assessment: Awaited<ReturnType<typeof evaluateRiskGate>>,
  impact: OrderImpact,
  journalValidation?: ReturnType<typeof validateJournalForOrder>,
): ExecutionResponse {
  return {
    riskDecision: {
      level: assessment.level,
      reasons: assessment.reasons,
      warnings: assessment.warnings,
      blocked: assessment.blocked,
      allowedAmount: assessment.allowedAmount,
      journalQualityScore: journalValidation?.qualityScore,
      journalLevel: journalValidation?.level,
      journalWarnings: journalValidation?.warnings,
    },
    impact,
  };
}

export async function simulateOrder(
  input: SimulateOrderInput,
): Promise<ExecutionResponse> {
  const { assessment, impact, journalValidation, limitPrice } =
    await buildRiskContext(input);

  const orderAmount = input.quantity * limitPrice;
  const finalAssessment = applyAllowedAmountCheck(assessment, orderAmount);

  await writeAuditLog("ORDER_SIMULATED", "OrderIntent", {
    ...input,
    riskLevel: finalAssessment.level,
    blocked: finalAssessment.blocked,
    allowedAmount: finalAssessment.allowedAmount,
    orderAmount,
  });

  return formatRiskResponse(finalAssessment, impact, journalValidation);
}

export async function executeOrder(
  input: ExecuteOrderInput,
): Promise<ExecutionResponse> {
  assertIdempotencyKey(input.idempotencyKey);

  const cached = await findExistingExecution(input.idempotencyKey);
  if (cached) {
    await writeAuditLog("ORDER_IDEMPOTENT_REPLAY", "OrderIntent", {
      idempotencyKey: input.idempotencyKey,
      orderIntentId: cached.orderIntentId,
    });
    return cached;
  }

  await checkExecutionRateLimit();

  const { settings, asset, limitPrice, assessment, impact, journalValidation } =
    await buildRiskContext(input);

  const requestedMode = input.mode ?? settings.executionMode;

  const orderAmount = input.quantity * limitPrice;
  const finalAssessment = applyAllowedAmountCheck(assessment, orderAmount);

  const mode: ExecutionMode =
    requestedMode === "LIVE"
      ? "LIVE"
      : requestedMode === "PAPER"
        ? "PAPER"
        : "MOCK";

  const orderIntent = await prisma.orderIntent.create({
    data: {
      assetId: input.assetId,
      journalId: input.journalId,
      side: input.side,
      quantity: input.quantity,
      limitPrice,
      status: finalAssessment.blocked ? "REJECTED" : "PENDING",
      idempotencyKey: input.idempotencyKey,
      executionMode: mode,
    },
  });

  await prisma.riskDecision.create({
    data: {
      orderIntentId: orderIntent.id,
      level: finalAssessment.level,
      reasons: JSON.stringify({
        reasons: finalAssessment.reasons,
        warnings: finalAssessment.warnings,
        allowedAmount: finalAssessment.allowedAmount,
      }),
      blocked: finalAssessment.blocked,
    },
  });

  await writeAuditLog("RISK_DECISION", "RiskDecision", {
    orderIntentId: orderIntent.id,
    level: finalAssessment.level,
    blocked: finalAssessment.blocked,
    reasons: finalAssessment.reasons,
    allowedAmount: finalAssessment.allowedAmount,
    orderAmount,
  });

  if (
    finalAssessment.blocked ||
    finalAssessment.level === "RED" ||
    finalAssessment.level === "BLACK"
  ) {
    await prisma.orderIntent.update({
      where: { id: orderIntent.id },
      data: { status: "REJECTED" },
    });

    const formatted = formatRiskResponse(
      finalAssessment,
      impact,
      journalValidation,
    );
    return {
      orderIntentId: orderIntent.id,
      ...formatted,
      riskDecision: {
        ...formatted.riskDecision,
        blocked: true,
      },
    };
  }

  if (mode === "LIVE") {
    await assertLiveExecutionAllowed(
      {
        confirmLive: input.confirmLive,
        livePassphrase: input.livePassphrase,
      },
      settings,
      orderAmount,
    );
  }

  const broker = getBroker(mode);
  const result = await broker.placeOrder({
    assetId: asset.id,
    symbol: asset.symbol,
    assetType: asset.assetType,
    side: input.side,
    quantity: input.quantity,
    limitPrice,
  });

  await prisma.executionLog.create({
    data: {
      orderIntentId: orderIntent.id,
      mode,
      status: result.success ? "FILLED" : "REJECTED",
      fillPrice: result.fillPrice,
      message: result.message,
      brokerOrderId: result.brokerOrderId,
      idempotencyKey: input.idempotencyKey,
    },
  });

  await prisma.orderIntent.update({
    where: { id: orderIntent.id },
    data: { status: result.success ? "EXECUTED" : "REJECTED" },
  });

  if (result.success && result.fillPrice) {
    const orderAmount = input.quantity * result.fillPrice;
    const existingPosition = await prisma.position.findFirst({
      where: { assetId: asset.id },
    });

    if (input.side === "BUY") {
      await prisma.userSettings.update({
        where: { id: settings.id },
        data: { cashBalance: { decrement: orderAmount } },
      });

      if (existingPosition) {
        const newQty = existingPosition.quantity + input.quantity;
        const newAvg =
          (existingPosition.quantity * existingPosition.avgPrice +
            input.quantity * result.fillPrice) /
          newQty;
        await prisma.position.update({
          where: { id: existingPosition.id },
          data: { quantity: newQty, avgPrice: newAvg },
        });
      } else {
        await prisma.position.create({
          data: {
            assetId: asset.id,
            quantity: input.quantity,
            avgPrice: result.fillPrice,
            bucket: asset.bucket,
          },
        });
      }
    } else if (existingPosition) {
      await prisma.userSettings.update({
        where: { id: settings.id },
        data: { cashBalance: { increment: orderAmount } },
      });

      const newQty = existingPosition.quantity - input.quantity;
      if (newQty <= 0) {
        await prisma.position.delete({ where: { id: existingPosition.id } });
      } else {
        await prisma.position.update({
          where: { id: existingPosition.id },
          data: { quantity: newQty },
        });
      }
    }

    const updatedSettings = await getUserSettings();
    const updatedPositions = await getPositionsWithMarketPrices();
    const newTotalValue =
      updatedSettings.cashBalance +
      updatedPositions.reduce((sum, p) => sum + p.currentValue, 0);
    await syncRiskBaselines(updatedSettings, newTotalValue);
  }

  await writeAuditLog(
    mode === "LIVE" && result.success
      ? "LIVE_ORDER_EXECUTED"
      : mode === "LIVE"
        ? "LIVE_ORDER_REJECTED"
        : "ORDER_EXECUTED",
    "ExecutionLog",
    {
      orderIntentId: orderIntent.id,
      mode,
      success: result.success,
      message: result.message,
      brokerOrderId: result.brokerOrderId,
      brokerName: result.brokerName,
    },
  );

  return {
    orderIntentId: orderIntent.id,
    ...formatRiskResponse(finalAssessment, impact, journalValidation),
    execution: {
      success: result.success,
      fillPrice: result.fillPrice,
      message: result.message,
      brokerOrderId: result.brokerOrderId,
    },
  };
}
