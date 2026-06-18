import { prisma } from "@/lib/db";
import { scoreJournal } from "@/lib/journal";
import type {
  ImpulsiveTrade,
  ReportAuditEvent,
  ReportOrderActivity,
} from "./types";

function journalInputFromRecord(journal: {
  title: string;
  thesis: string;
  risks: string;
  invalidation: string;
  emotionalState: string;
  timeHorizon: string;
  maxAcceptableLoss: number;
  exitRule: string;
  emotionScore: number;
  confidenceScore: number;
  planned: boolean;
}) {
  return {
    title: journal.title,
    thesis: journal.thesis,
    risks: journal.risks,
    invalidation: journal.invalidation,
    emotionalState: journal.emotionalState,
    timeHorizon: journal.timeHorizon,
    maxAcceptableLoss: journal.maxAcceptableLoss,
    exitRule: journal.exitRule,
    emotionScore: journal.emotionScore,
    confidenceScore: journal.confidenceScore,
    planned: journal.planned,
  };
}

export async function listOrderActivity({
  since,
  until,
}: {
  since: Date;
  until: Date;
}): Promise<ReportOrderActivity[]> {
  const orders = await prisma.orderIntent.findMany({
    where: { createdAt: { gte: since, lte: until } },
    include: {
      asset: { select: { symbol: true } },
      journal: {
        select: {
          title: true,
          emotionScore: true,
          planned: true,
          thesis: true,
          risks: true,
          invalidation: true,
          emotionalState: true,
          timeHorizon: true,
          maxAcceptableLoss: true,
          exitRule: true,
          confidenceScore: true,
        },
      },
      riskDecisions: { orderBy: { createdAt: "desc" }, take: 1 },
      executionLogs: { orderBy: { createdAt: "desc" }, take: 1 },
    },
    orderBy: { createdAt: "desc" },
  });

  return orders.map((order) => {
    const risk = order.riskDecisions[0];
    const execution = order.executionLogs[0];
    return {
      id: order.id,
      symbol: order.asset.symbol,
      side: order.side,
      quantity: order.quantity,
      status: order.status,
      executionMode: order.executionMode,
      riskLevel: risk?.level ?? null,
      riskBlocked: risk?.blocked ?? false,
      executionStatus: execution?.status ?? null,
      fillPrice: execution?.fillPrice ?? null,
      journalTitle: order.journal?.title ?? null,
      createdAt: order.createdAt.toISOString(),
    };
  });
}

export async function listAuditEvents({
  since,
  until,
  action,
}: {
  since: Date;
  until: Date;
  action?: string;
}): Promise<ReportAuditEvent[]> {
  const logs = await prisma.auditLog.findMany({
    where: {
      createdAt: { gte: since, lte: until },
      ...(action ? { action } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return logs.map((log) => ({
    id: log.id,
    action: log.action,
    entity: log.entity,
    entityId: log.entityId,
    createdAt: log.createdAt.toISOString(),
  }));
}

export async function findImpulsiveTrades({
  since,
  until,
}: {
  since: Date;
  until: Date;
}): Promise<ImpulsiveTrade[]> {
  const orders = await prisma.orderIntent.findMany({
    where: {
      createdAt: { gte: since, lte: until },
      journalId: { not: null },
      executionLogs: { some: { status: "FILLED" } },
    },
    include: {
      asset: { select: { symbol: true } },
      journal: true,
      executionLogs: {
        where: { status: "FILLED" },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  const impulsive: ImpulsiveTrade[] = [];

  for (const order of orders) {
    if (!order.journal) continue;
    const scored = scoreJournal(journalInputFromRecord(order.journal));
    const isImpulsive =
      order.journal.emotionScore >= 8 ||
      !order.journal.planned ||
      scored.level === "RED";

    if (!isImpulsive) continue;

    const execution = order.executionLogs[0];
    let reason = "Journal RED";
    if (order.journal.emotionScore >= 8) reason = "Emotion score elevato";
    else if (!order.journal.planned) reason = "Trade non pianificato";

    impulsive.push({
      orderIntentId: order.id,
      symbol: order.asset.symbol,
      side: order.side,
      quantity: order.quantity,
      fillPrice: execution?.fillPrice ?? null,
      journalTitle: order.journal.title,
      emotionScore: order.journal.emotionScore,
      planned: order.journal.planned,
      journalLevel: scored.level,
      reason,
      executedAt: execution?.createdAt.toISOString() ?? order.createdAt.toISOString(),
    });
  }

  return impulsive;
}
