import { prisma } from "@/lib/db";
import type { ExecutionResponse } from "./index";

const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;

const KEY_PATTERN = /^[a-zA-Z0-9_-]{8,64}$/;

export class IdempotencyKeyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IdempotencyKeyError";
  }
}

export function assertIdempotencyKey(key: string): void {
  if (!KEY_PATTERN.test(key)) {
    throw new IdempotencyKeyError(
      "idempotencyKey non valida: usa 8-64 caratteri alfanumerici, trattini o underscore.",
    );
  }
}

function parseRiskReasons(raw: string) {
  try {
    const parsed = JSON.parse(raw) as {
      reasons?: string[];
      warnings?: string[];
      allowedAmount?: number;
    };
    return {
      reasons: parsed.reasons ?? [],
      warnings: parsed.warnings ?? [],
      allowedAmount: parsed.allowedAmount ?? 0,
    };
  } catch {
    return { reasons: [raw], warnings: [], allowedAmount: 0 };
  }
}

export async function findExistingExecution(
  idempotencyKey: string,
): Promise<ExecutionResponse | null> {
  const existing = await prisma.orderIntent.findUnique({
    where: { idempotencyKey },
    include: {
      riskDecisions: { orderBy: { createdAt: "desc" }, take: 1 },
      executionLogs: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });

  if (!existing) {
    return null;
  }

  const ageMs = Date.now() - existing.createdAt.getTime();
  if (ageMs > IDEMPOTENCY_TTL_MS) {
    return null;
  }

  const riskDecision = existing.riskDecisions[0];
  const executionLog = existing.executionLogs[0];
  const parsedRisk = riskDecision
    ? parseRiskReasons(riskDecision.reasons)
    : { reasons: [], warnings: [], allowedAmount: 0 };

  const response: ExecutionResponse = {
    orderIntentId: existing.id,
    idempotentReplay: true,
    riskDecision: {
      level: riskDecision?.level ?? "GREEN",
      reasons: parsedRisk.reasons,
      warnings: parsedRisk.warnings,
      blocked: riskDecision?.blocked ?? false,
      allowedAmount: parsedRisk.allowedAmount,
    },
  };

  if (existing.status === "PENDING" && !executionLog) {
    return {
      ...response,
      executionIncomplete: true,
      execution: {
        success: false,
        fillPrice: null,
        message:
          "Stato esecuzione incompleto: ordine in sospeso senza execution log.",
      },
    };
  }

  if (executionLog) {
    response.execution = {
      success: executionLog.status === "FILLED",
      fillPrice: executionLog.fillPrice,
      message: executionLog.message,
      brokerOrderId: executionLog.brokerOrderId ?? undefined,
    };
    return response;
  }

  if (existing.status === "REJECTED") {
    response.execution = {
      success: false,
      fillPrice: null,
      message: "Rifiutato dal risk gate.",
    };
    response.riskDecision = {
      ...response.riskDecision,
      blocked: true,
    };
    return response;
  }

  if (existing.status === "EXECUTED") {
    response.executionIncomplete = true;
    response.execution = {
      success: false,
      fillPrice: null,
      message: "Ordine incompleto: execution log assente.",
    };
    return response;
  }

  return null;
}
