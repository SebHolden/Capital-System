import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/security";
import { shouldDegrade } from "./degradation";
import {
  buildStrategyRanking,
  syncStrategyEvaluations,
} from "./rankings";

export async function evaluatePromotions(): Promise<{
  promoted: string[];
}> {
  const strategies = await prisma.strategy.findMany({
    where: { status: "PAPER_ACTIVE" },
    include: {
      paperSignals: {
        where: { status: { in: ["OPEN", "EXPIRED", "CLOSED"] } },
      },
    },
  });

  const promoted: string[] = [];

  for (const strategy of strategies) {
    const ranking = buildStrategyRanking(
      { id: strategy.id, name: strategy.name, status: strategy.status },
      strategy.paperSignals,
    );

    if (!ranking.promotionReady || ranking.recommendation !== "PROMOTE") {
      continue;
    }

    await prisma.strategy.update({
      where: { id: strategy.id },
      data: {
        status: "PROMOTED",
        promotedAt: new Date(),
        evaluationScore: ranking.score,
        rating: ranking.rating,
        lastEvaluatedAt: new Date(),
      },
    });

    promoted.push(strategy.id);

    await writeAuditLog("STRATEGY_PROMOTED", "Strategy", {
      strategyId: strategy.id,
      avg30dPct: ranking.avg30dPct,
      signalCount: ranking.evaluatedCount,
      ruleFollowedPct: ranking.ruleFollowedPct,
      score: ranking.score,
      rating: ranking.rating,
      winRate: ranking.winRate,
    });
  }

  return { promoted };
}

export async function evaluateDegradations(): Promise<{
  degraded: string[];
}> {
  const strategies = await prisma.strategy.findMany({
    where: { status: "PAPER_ACTIVE" },
    include: { paperSignals: true },
  });

  const degraded: string[] = [];

  for (const strategy of strategies) {
    if (strategy.paperSignals.length === 0) continue;

    const ranking = buildStrategyRanking(
      { id: strategy.id, name: strategy.name, status: strategy.status },
      strategy.paperSignals,
    );

    const { degrade, reasons } = shouldDegrade(ranking);
    if (!degrade) continue;

    await prisma.strategy.update({
      where: { id: strategy.id },
      data: {
        status: "REJECTED",
        evaluationScore: ranking.score,
        rating: ranking.rating,
        lastEvaluatedAt: new Date(),
      },
    });

    degraded.push(strategy.id);

    await writeAuditLog("STRATEGY_DEGRADED", "Strategy", {
      strategyId: strategy.id,
      score: ranking.score,
      rating: ranking.rating,
      reasons,
      winRate: ranking.winRate,
    });
  }

  return { degraded };
}

export async function runEvaluationPipeline(): Promise<{
  promoted: string[];
  degraded: string[];
  evaluationsSynced: number;
}> {
  const degradation = await evaluateDegradations();
  const promotion = await evaluatePromotions();
  const sync = await syncStrategyEvaluations();

  return {
    promoted: promotion.promoted,
    degraded: degradation.degraded,
    evaluationsSynced: sync.updated,
  };
}
