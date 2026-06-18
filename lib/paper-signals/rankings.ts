import type { PaperSignal, StrategyStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  getPaperMaxMaePct,
  getPaperPromotionMinAvg30dPct,
  getPaperPromotionMinRuleFollowedPct,
  getPaperPromotionMinSignals,
} from "./eligibility";

export interface PaperStrategyRanking {
  strategyId: string;
  strategyName: string;
  status: StrategyStatus;
  signalCount: number;
  openCount: number;
  closedCount: number;
  expiredCount: number;
  avgCurrentPct: number | null;
  avg1dPct: number | null;
  avg7dPct: number | null;
  avg30dPct: number | null;
  worstMaePct: number | null;
  ruleFollowedPct: number | null;
  promotionReady: boolean;
  promotionBlockers: string[];
}

function average(values: Array<number | null | undefined>): number | null {
  const nums = values.filter(
    (v): v is number => v !== null && v !== undefined,
  );
  if (nums.length === 0) return null;
  return nums.reduce((sum, v) => sum + v, 0) / nums.length;
}

function minValue(values: Array<number | null | undefined>): number | null {
  const nums = values.filter(
    (v): v is number => v !== null && v !== undefined,
  );
  if (nums.length === 0) return null;
  return Math.min(...nums);
}

export function buildStrategyRanking(
  strategy: { id: string; name: string; status: StrategyStatus },
  signals: PaperSignal[],
): PaperStrategyRanking {
  const minSignals = getPaperPromotionMinSignals();
  const minAvg30d = getPaperPromotionMinAvg30dPct();
  const maxMae = getPaperMaxMaePct();
  const minRuleFollowedPct = getPaperPromotionMinRuleFollowedPct();

  const openCount = signals.filter((s) => s.status === "OPEN").length;
  const closedCount = signals.filter((s) => s.status === "CLOSED").length;
  const expiredCount = signals.filter((s) => s.status === "EXPIRED").length;

  const ruleFollowedCount = signals.filter((s) => s.ruleFollowed).length;
  const ruleFollowedPct =
    signals.length > 0 ? (ruleFollowedCount / signals.length) * 100 : null;

  const with30d = signals.filter(
    (s) => s.result30dPct !== null && s.result30dPct !== undefined,
  );
  const eligibleForAvg = with30d.filter((s) => s.ruleFollowed);
  const avg30dSource =
    eligibleForAvg.length > 0 ? eligibleForAvg : with30d;
  const avg30dPct = average(avg30dSource.map((s) => s.result30dPct));

  const maeBreached = signals.some(
    (s) => s.maePct !== null && s.maePct !== undefined && s.maePct < -maxMae,
  );

  const promotionBlockers: string[] = [];

  if (with30d.length < minSignals) {
    promotionBlockers.push(
      `Servono almeno ${minSignals} segnali con risultato 30d (attuali: ${with30d.length}).`,
    );
  }

  if (avg30dPct !== null && avg30dPct < minAvg30d) {
    promotionBlockers.push(
      `Media 30d ${avg30dPct.toFixed(2)}% sotto soglia ${minAvg30d}%.`,
    );
  }

  if (maeBreached) {
    promotionBlockers.push(`MAE oltre soglia -${maxMae}%.`);
  }

  if (
    minRuleFollowedPct > 0 &&
    ruleFollowedPct !== null &&
    ruleFollowedPct < minRuleFollowedPct
  ) {
    promotionBlockers.push(
      `Rule followed ${ruleFollowedPct.toFixed(0)}% sotto soglia ${minRuleFollowedPct}%.`,
    );
  }

  const promotionReady =
    strategy.status === "PAPER_ACTIVE" && promotionBlockers.length === 0;

  return {
    strategyId: strategy.id,
    strategyName: strategy.name,
    status: strategy.status,
    signalCount: signals.length,
    openCount,
    closedCount,
    expiredCount,
    avgCurrentPct: average(signals.map((s) => s.currentResultPct)),
    avg1dPct: average(signals.map((s) => s.result1dPct)),
    avg7dPct: average(signals.map((s) => s.result7dPct)),
    avg30dPct,
    worstMaePct: minValue(signals.map((s) => s.maePct)),
    ruleFollowedPct,
    promotionReady,
    promotionBlockers,
  };
}

export async function getPaperStrategyRankings(): Promise<
  PaperStrategyRanking[]
> {
  const strategies = await prisma.strategy.findMany({
    where: {
      status: { in: ["PAPER_ACTIVE", "PROMOTED"] },
    },
    include: {
      paperSignals: true,
    },
    orderBy: { name: "asc" },
  });

  const rankings = strategies
    .filter((s) => s.paperSignals.length > 0)
    .map((strategy) =>
      buildStrategyRanking(
        { id: strategy.id, name: strategy.name, status: strategy.status },
        strategy.paperSignals,
      ),
    );

  rankings.sort((a, b) => {
    const a30 = a.avg30dPct ?? -Infinity;
    const b30 = b.avg30dPct ?? -Infinity;
    if (b30 !== a30) return b30 - a30;
    const aRule = a.ruleFollowedPct ?? 0;
    const bRule = b.ruleFollowedPct ?? 0;
    return bRule - aRule;
  });

  return rankings;
}
