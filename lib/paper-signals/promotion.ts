import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/security";
import {
  getPaperMaxMaePct,
  getPaperPromotionMinAvg30dPct,
  getPaperPromotionMinSignals,
} from "./eligibility";

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
  const minSignals = getPaperPromotionMinSignals();
  const minAvg30d = getPaperPromotionMinAvg30dPct();
  const maxMae = getPaperMaxMaePct();

  for (const strategy of strategies) {
    const with30d = strategy.paperSignals.filter(
      (s) => s.result30dPct !== null && s.result30dPct !== undefined,
    );

    if (with30d.length < minSignals) continue;

    const avg30d =
      with30d.reduce((sum, s) => sum + (s.result30dPct ?? 0), 0) /
      with30d.length;

    const maeBreached = strategy.paperSignals.some(
      (s) => s.maePct !== null && s.maePct !== undefined && s.maePct < -maxMae,
    );

    if (avg30d < minAvg30d || maeBreached) continue;

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
    });
  }

  return { promoted };
}
