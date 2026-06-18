import type { ExecutionMode } from "@prisma/client";
import type { DbClient } from "@/lib/security";
import { prisma } from "@/lib/db";
import type { OrderImpact } from "@/lib/risk/types";
import { writeAuditLog } from "@/lib/security";
import type { ExecutionResponse } from "./index";

export interface RejectOrderAttemptParams {
  orderIntentId: string;
  idempotencyKey: string;
  mode: ExecutionMode;
  reason: string;
  auditAction: string;
  riskDecision: ExecutionResponse["riskDecision"];
  impact?: OrderImpact;
  auditPayload?: Record<string, unknown>;
  client?: DbClient;
}

export async function rejectOrderAttempt(
  params: RejectOrderAttemptParams,
): Promise<ExecutionResponse> {
  const run = async (tx: DbClient) => {
    await tx.orderIntent.update({
      where: { id: params.orderIntentId },
      data: { status: "REJECTED" },
    });

    await tx.executionLog.create({
      data: {
        orderIntentId: params.orderIntentId,
        mode: params.mode,
        status: "REJECTED",
        fillPrice: null,
        message: params.reason,
        idempotencyKey: params.idempotencyKey,
      },
    });

    await writeAuditLog(
      params.auditAction,
      "OrderIntent",
      {
        orderIntentId: params.orderIntentId,
        idempotencyKey: params.idempotencyKey,
        mode: params.mode,
        reason: params.reason,
        ...params.auditPayload,
      },
      params.orderIntentId,
      tx,
    );
  };

  if (params.client) {
    await run(params.client);
  } else {
    await prisma.$transaction(async (tx) => {
      await run(tx);
    });
  }

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
