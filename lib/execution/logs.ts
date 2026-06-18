import type { ExecutionMode, ExecutionStatus } from "@prisma/client";
import { prisma } from "@/lib/db";

export interface ExecutionLogRow {
  id: string;
  mode: ExecutionMode;
  status: ExecutionStatus;
  fillPrice: number | null;
  costBasisPerUnit: number | null;
  realizedPnl: number | null;
  message: string;
  brokerOrderId: string | null;
  createdAt: string;
  order: {
    id: string;
    side: string;
    quantity: number;
    symbol: string;
    executionMode: ExecutionMode | null;
    riskLevel: string | null;
    riskBlocked: boolean;
  };
}

export async function listExecutionLogs(options?: {
  mode?: ExecutionMode;
  status?: ExecutionStatus;
  since?: Date;
  until?: Date;
  limit?: number;
}): Promise<ExecutionLogRow[]> {
  const logs = await prisma.executionLog.findMany({
    where: {
      mode: options?.mode,
      status: options?.status,
      createdAt: {
        gte: options?.since,
        lte: options?.until,
      },
    },
    take: options?.limit ?? 100,
    orderBy: { createdAt: "desc" },
    include: {
      orderIntent: {
        include: {
          asset: { select: { symbol: true } },
          riskDecisions: {
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
      },
    },
  });

  return logs.map((log) => {
    const risk = log.orderIntent.riskDecisions[0];
    return {
      id: log.id,
      mode: log.mode,
      status: log.status,
      fillPrice: log.fillPrice,
      costBasisPerUnit: log.costBasisPerUnit,
      realizedPnl: log.realizedPnl,
      message: log.message,
      brokerOrderId: log.brokerOrderId,
      createdAt: log.createdAt.toISOString(),
      order: {
        id: log.orderIntent.id,
        side: log.orderIntent.side,
        quantity: log.orderIntent.quantity,
        symbol: log.orderIntent.asset.symbol,
        executionMode: log.orderIntent.executionMode,
        riskLevel: risk?.level ?? null,
        riskBlocked: risk?.blocked ?? false,
      },
    };
  });
}
