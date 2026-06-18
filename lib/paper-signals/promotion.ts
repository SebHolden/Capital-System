import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/security";
import { buildStrategyRanking } from "./rankings";

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

    if (!ranking.promotionReady) continue;

    const with30d = strategy.paperSignals.filter(
      (s) => s.result30dPct !== null && s.result30dPct !== undefined,
    );
    const eligibleForAvg = with30d.filter((s) => s.ruleFollowed);
    const avg30dSource =
      eligibleForAvg.length > 0 ? eligibleForAvg : with30d;
    const avg30d =
      avg30dSource.reduce((sum, s) => sum + (s.result30dPct ?? 0), 0) /
      avg30dSource.length;

    await prisma.strategy.update({
      where: { id: strategy.id },
      data: {
        status: "PROMOTED",
        promotedAt: new Date(),
      },
    });

    promoted.push(strategy.id);

    await writeAuditLog("STRATEGY_PROMOTED", "Strategy", {
      strategyId: strategy.id,
      avg30dPct: avg30d,
      signalCount: with30d.length,
      ruleFollowedPct: ranking.ruleFollowedPct,
    });
  }

  return { promoted };
}
