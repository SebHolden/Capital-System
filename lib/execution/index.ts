import type { ExecutionMode } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { getBroker } from "@/lib/brokers";
import type { ExecutionResult } from "@/lib/brokers/types";
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
  IdempotencyKeyError,
} from "./idempotency";
import {
  assertLiveExecutionAllowed,
  LiveLimitError,
  LiveNotEnabledError,
  LivePassphraseError,
  LivePrerequisiteError,
} from "./liveGate";
import { checkExecutionRateLimit } from "./rateLimit";
import { rejectOrderAttempt, type RejectOrderAttemptParams } from "./rejectOrder";

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
  executionIncomplete?: boolean;
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
    experimentalCashBalance: syncedSettings.experimentalCashBalance,
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

function isUniqueConstraintError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

function buildRiskDecisionPayload(
  finalAssessment: RiskAssessment,
  journalValidation?: ReturnType<typeof validateJournalForOrder>,
): ExecutionResponse["riskDecision"] {
  return {
    level: finalAssessment.level,
    reasons: finalAssessment.reasons,
    warnings: finalAssessment.warnings,
    blocked: finalAssessment.blocked,
    allowedAmount: finalAssessment.allowedAmount,
    journalQualityScore: journalValidation?.qualityScore,
    journalLevel: journalValidation?.level,
    journalWarnings: journalValidation?.warnings,
  };
}

async function createOrderIntentWithRisk(params: {
  input: ExecuteOrderInput;
  limitPrice: number;
  mode: ExecutionMode;
  finalAssessment: RiskAssessment;
  orderAmount: number;
}) {
  const isRiskBlocked =
    params.finalAssessment.blocked ||
    params.finalAssessment.level === "RED" ||
    params.finalAssessment.level === "BLACK";

  return prisma.$transaction(async (tx) => {
    const orderIntent = await tx.orderIntent.create({
      data: {
        assetId: params.input.assetId,
        journalId: params.input.journalId,
        side: params.input.side,
        quantity: params.input.quantity,
        limitPrice: params.limitPrice,
        status: isRiskBlocked ? "REJECTED" : "PENDING",
        idempotencyKey: params.input.idempotencyKey,
        executionMode: params.mode,
      },
    });

    await tx.riskDecision.create({
      data: {
        orderIntentId: orderIntent.id,
        level: params.finalAssessment.level,
        reasons: JSON.stringify({
          reasons: params.finalAssessment.reasons,
          warnings: params.finalAssessment.warnings,
          allowedAmount: params.finalAssessment.allowedAmount,
        }),
        blocked: params.finalAssessment.blocked,
      },
    });

    await writeAuditLog(
      "RISK_DECISION",
      "RiskDecision",
      {
        orderIntentId: orderIntent.id,
        level: params.finalAssessment.level,
        blocked: params.finalAssessment.blocked,
        reasons: params.finalAssessment.reasons,
        allowedAmount: params.finalAssessment.allowedAmount,
        orderAmount: params.orderAmount,
      },
      undefined,
      tx,
    );

    return orderIntent;
  });
}

async function persistSuccessfulExecution(params: {
  orderIntentId: string;
  idempotencyKey: string;
  mode: ExecutionMode;
  result: ExecutionResult;
  input: ExecuteOrderInput;
  asset: Awaited<ReturnType<typeof buildRiskContext>>["asset"];
  settings: Awaited<ReturnType<typeof buildRiskContext>>["settings"];
  costBasisPerUnit?: number;
  realizedPnl?: number;
}) {
  const existingPosition = await prisma.position.findFirst({
    where: { assetId: params.asset.id },
  });

  await prisma.$transaction(async (tx) => {
    await tx.executionLog.create({
      data: {
        orderIntentId: params.orderIntentId,
        mode: params.mode,
        status: "FILLED",
        fillPrice: params.result.fillPrice,
        message: params.result.message,
        brokerOrderId: params.result.brokerOrderId,
        idempotencyKey: params.idempotencyKey,
        costBasisPerUnit: params.costBasisPerUnit,
        realizedPnl: params.realizedPnl,
      },
    });

    await tx.orderIntent.update({
      where: { id: params.orderIntentId },
      data: { status: "EXECUTED" },
    });

    if (params.result.fillPrice) {
      const fillAmount = params.input.quantity * params.result.fillPrice;

      if (params.input.side === "BUY") {
        const cashUpdate =
          params.asset.bucket === "SPECULATIVE"
            ? { experimentalCashBalance: { decrement: fillAmount } }
            : { cashBalance: { decrement: fillAmount } };

        await tx.userSettings.update({
          where: { id: params.settings.id },
          data: cashUpdate,
        });

        if (existingPosition) {
          const newQty = existingPosition.quantity + params.input.quantity;
          const newAvg =
            (existingPosition.quantity * existingPosition.avgPrice +
              params.input.quantity * params.result.fillPrice!) /
            newQty;
          await tx.position.update({
            where: { id: existingPosition.id },
            data: { quantity: newQty, avgPrice: newAvg },
          });
        } else {
          await tx.position.create({
            data: {
              assetId: params.asset.id,
              quantity: params.input.quantity,
              avgPrice: params.result.fillPrice,
              bucket: params.asset.bucket,
            },
          });
        }
      } else if (existingPosition) {
        const cashUpdate =
          existingPosition.bucket === "SPECULATIVE"
            ? { experimentalCashBalance: { increment: fillAmount } }
            : { cashBalance: { increment: fillAmount } };

        await tx.userSettings.update({
          where: { id: params.settings.id },
          data: cashUpdate,
        });

        const newQty = existingPosition.quantity - params.input.quantity;
        if (newQty <= 0) {
          await tx.position.delete({ where: { id: existingPosition.id } });
        } else {
          await tx.position.update({
            where: { id: existingPosition.id },
            data: { quantity: newQty },
          });
        }
      }
    }

    await writeAuditLog(
      params.mode === "LIVE" ? "LIVE_ORDER_EXECUTED" : "ORDER_EXECUTED",
      "ExecutionLog",
      {
        orderIntentId: params.orderIntentId,
        mode: params.mode,
        success: true,
        message: params.result.message,
        brokerOrderId: params.result.brokerOrderId,
        brokerName: params.result.brokerName,
      },
      params.orderIntentId,
      tx,
    );
  });
}

async function finalizeRejectedOrder(
  params: RejectOrderAttemptParams,
): Promise<ExecutionResponse> {
  try {
    return await rejectOrderAttempt(params);
  } catch (error) {
    const persistError =
      error instanceof Error ? error.message : "Errore persistenza rifiuto ordine.";

    await prisma.orderIntent
      .update({
        where: { id: params.orderIntentId },
        data: { status: "REJECTED" },
      })
      .catch(() => undefined);

    await writeAuditLog(
      "EXECUTION_REJECT_FAILED",
      "OrderIntent",
      {
        orderIntentId: params.orderIntentId,
        idempotencyKey: params.idempotencyKey,
        reason: params.reason,
        auditAction: params.auditAction,
        persistError,
        ...params.auditPayload,
      },
      params.orderIntentId,
    );

    return {
      orderIntentId: params.orderIntentId,
      riskDecision: params.riskDecision,
      impact: params.impact,
      execution: {
        success: false,
        fillPrice: null,
        message: params.reason,
      },
    };
  }
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

  const riskDecision = buildRiskDecisionPayload(finalAssessment, journalValidation);

  let orderIntent;
  try {
    orderIntent = await createOrderIntentWithRisk({
      input,
      limitPrice,
      mode,
      finalAssessment,
      orderAmount,
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      const replay = await findExistingExecution(input.idempotencyKey);
      if (replay) {
        await writeAuditLog("ORDER_IDEMPOTENT_REPLAY", "OrderIntent", {
          idempotencyKey: input.idempotencyKey,
          orderIntentId: replay.orderIntentId,
        });
        return replay;
      }
      throw new IdempotencyKeyError(
        "idempotencyKey già utilizzata: attendi il completamento o usa una nuova chiave.",
      );
    }
    throw error;
  }

  if (
    finalAssessment.blocked ||
    finalAssessment.level === "RED" ||
    finalAssessment.level === "BLACK"
  ) {
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
      execution: {
        success: false,
        fillPrice: null,
        message: "Rifiutato dal risk gate.",
      },
    };
  }

  if (mode === "LIVE") {
    try {
      await assertLiveExecutionAllowed(
        {
          confirmLive: input.confirmLive,
          livePassphrase: input.livePassphrase,
        },
        settings,
        orderAmount,
      );
    } catch (error) {
      let auditAction = "LIVE_GATE_REJECTED";
      const auditPayload: Record<string, unknown> = {};

      if (error instanceof LivePassphraseError) {
        auditAction = "LIVE_PASSPHRASE_REJECTED";
      } else if (error instanceof LivePrerequisiteError) {
        auditPayload.reasons = error.reasons;
      } else if (error instanceof LiveLimitError) {
        auditAction = "LIVE_LIMIT_REJECTED";
      } else if (error instanceof LiveNotEnabledError) {
        auditAction = "LIVE_NOT_ENABLED_REJECTED";
      }

      const reason =
        error instanceof Error ? error.message : "Live gate fallito.";

      return finalizeRejectedOrder({
        orderIntentId: orderIntent.id,
        idempotencyKey: input.idempotencyKey,
        mode,
        reason,
        auditAction,
        riskDecision,
        impact,
        auditPayload,
      });
    }
  }

  const broker = getBroker(mode);
  let result: ExecutionResult;
  try {
    result = await broker.placeOrder({
      assetId: asset.id,
      symbol: asset.symbol,
      assetType: asset.assetType,
      side: input.side,
      quantity: input.quantity,
      limitPrice,
    });
  } catch (error) {
    const reason =
      error instanceof Error ? error.message : "Errore broker imprevisto.";
    return finalizeRejectedOrder({
      orderIntentId: orderIntent.id,
      idempotencyKey: input.idempotencyKey,
      mode,
      reason,
      auditAction: "BROKER_ERROR",
      riskDecision,
      impact,
    });
  }

  if (!result.success) {
    return finalizeRejectedOrder({
      orderIntentId: orderIntent.id,
      idempotencyKey: input.idempotencyKey,
      mode,
      reason: result.message,
      auditAction: mode === "LIVE" ? "LIVE_ORDER_REJECTED" : "ORDER_REJECTED",
      riskDecision,
      impact,
      auditPayload: {
        brokerOrderId: result.brokerOrderId,
        brokerName: result.brokerName,
      },
    });
  }

  const existingPosition = await prisma.position.findFirst({
    where: { assetId: asset.id },
  });

  let costBasisPerUnit: number | undefined;
  let realizedPnl: number | undefined;
  if (
    input.side === "SELL" &&
    existingPosition &&
    result.fillPrice
  ) {
    costBasisPerUnit = existingPosition.avgPrice;
    realizedPnl =
      (result.fillPrice - existingPosition.avgPrice) * input.quantity;
  }

  try {
    await persistSuccessfulExecution({
      orderIntentId: orderIntent.id,
      idempotencyKey: input.idempotencyKey,
      mode,
      result,
      input,
      asset,
      settings,
      costBasisPerUnit,
      realizedPnl,
    });
  } catch (error) {
    const reason =
      error instanceof Error
        ? error.message
        : "Errore persistenza esecuzione ordine.";
    return finalizeRejectedOrder({
      orderIntentId: orderIntent.id,
      idempotencyKey: input.idempotencyKey,
      mode,
      reason,
      auditAction: "EXECUTION_FAILED",
      riskDecision,
      impact,
      auditPayload: {
        brokerOrderId: result.brokerOrderId,
        brokerName: result.brokerName,
        note: "Broker ha risposto success ma persistenza DB fallita.",
      },
    });
  }

  const updatedSettings = await getUserSettings();
  const updatedPositions = await getPositionsWithMarketPrices();
  const newTotalValue =
    updatedSettings.cashBalance +
    updatedSettings.experimentalCashBalance +
    updatedPositions.reduce((sum, p) => sum + p.currentValue, 0);
  await syncRiskBaselines(updatedSettings, newTotalValue);

  return {
    orderIntentId: orderIntent.id,
    ...formatRiskResponse(finalAssessment, impact, journalValidation),
    execution: {
      success: true,
      fillPrice: result.fillPrice,
      message: result.message,
      brokerOrderId: result.brokerOrderId,
    },
  };
}
