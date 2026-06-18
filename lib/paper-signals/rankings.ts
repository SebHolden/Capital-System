import type { PaperSignal, StrategyRating, StrategyStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  getPaperMaxMaePct,
  getPaperPromotionMinAvg30dPct,
  getPaperPromotionMinRuleFollowedPct,
  getPaperPromotionMinSignals,
  getPaperPromotionMinWinRatePct,
} from "./eligibility";
import {
  computeRating,
  computeRecommendation,
  computeStrategyScore,
  type StrategyRecommendation,
} from "./scoring";
import { isEvaluatedOutcome } from "./outcome";

export interface PaperStrategyRanking {
  strategyId: string;
  strategyName: string;
  status: StrategyStatus;
  signalCount: number;
  openCount: number;
  closedCount: number;
  expiredCount: number;
  winCount: number;
  lossCount: number;
  flatCount: number;
  insufficientCount: number;
  pendingCount: number;
  evaluatedCount: number;
  winRate: number | null;
  avgCurrentPct: number | null;
  avg1dPct: number | null;
  avg7dPct: number | null;
  avg30dPct: number | null;
  worstMaePct: number | null;
  avgMaeMfeRatio: number | null;
  ruleFollowedPct: number | null;
  score: number;
  rating: StrategyRating;
  recommendation: StrategyRecommendation;
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

function countOutcomes(signals: PaperSignal[]) {
  return {
    winCount: signals.filter((s) => s.outcome === "WIN").length,
    lossCount: signals.filter((s) => s.outcome === "LOSS").length,
    flatCount: signals.filter((s) => s.outcome === "FLAT").length,
    insufficientCount: signals.filter((s) => s.outcome === "INSUFFICIENT_DATA")
      .length,
    pendingCount: signals.filter((s) => s.outcome === "PENDING").length,
    expiredOutcomeCount: signals.filter((s) => s.outcome === "EXPIRED").length,
  };
}

export function buildStrategyRanking(
  strategy: { id: string; name: string; status: StrategyStatus },
  signals: PaperSignal[],
): PaperStrategyRanking {
  const minSignals = getPaperPromotionMinSignals();
  const minAvg30d = getPaperPromotionMinAvg30dPct();
  const maxMae = getPaperMaxMaePct();
  const minRuleFollowedPct = getPaperPromotionMinRuleFollowedPct();
  const minWinRatePct = getPaperPromotionMinWinRatePct();

  const openCount = signals.filter((s) => s.status === "OPEN").length;
  const closedCount = signals.filter((s) => s.status === "CLOSED").length;
  const expiredCount = signals.filter((s) => s.status === "EXPIRED").length;

  const outcomes = countOutcomes(signals);
  const evaluatedCount = signals.filter((s) =>
    isEvaluatedOutcome(s.outcome),
  ).length;

  const decisiveCount =
    outcomes.winCount + outcomes.lossCount + outcomes.flatCount;
  const winRate =
    decisiveCount > 0 ? (outcomes.winCount / decisiveCount) * 100 : null;

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

  const maeMfeRatios = signals
    .filter(
      (s) =>
        s.maePct !== null &&
        s.mfePct !== null &&
        s.mfePct !== undefined &&
        s.mfePct > 0,
    )
    .map((s) => Math.abs((s.maePct ?? 0) / (s.mfePct ?? 1)));

  const avgMaeMfeRatio = average(maeMfeRatios);

  const maeBreached = signals.some(
    (s) => s.maePct !== null && s.maePct !== undefined && s.maePct < -maxMae,
  );

  const score = computeStrategyScore({
    winCount: outcomes.winCount,
    lossCount: outcomes.lossCount,
    flatCount: outcomes.flatCount,
    expiredCount: expiredCount + outcomes.expiredOutcomeCount,
    insufficientCount: outcomes.insufficientCount,
    pendingCount: outcomes.pendingCount,
    avg7dPct: average(signals.map((s) => s.result7dPct)),
    avg30dPct,
    worstMaePct: minValue(signals.map((s) => s.maePct)),
    avgMaeMfeRatio,
    ruleFollowedPct,
  });

  const rating = computeRating(score);

  const promotionBlockers: string[] = [];

  if (evaluatedCount < minSignals) {
    promotionBlockers.push(
      `Servono almeno ${minSignals} segnali valutati (attuali: ${evaluatedCount}).`,
    );
  }

  if (rating !== "PROMOTABLE") {
    promotionBlockers.push(`Rating ${rating} — serve PROMOTABLE (score ≥ 81).`);
  }

  if (avg30dPct !== null && avg30dPct < minAvg30d) {
    promotionBlockers.push(
      `Media 30d ${avg30dPct.toFixed(2)}% sotto soglia ${minAvg30d}%.`,
    );
  }

  if (winRate !== null && winRate < minWinRatePct) {
    promotionBlockers.push(
      `Win rate ${winRate.toFixed(0)}% sotto soglia ${minWinRatePct}%.`,
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

  const recommendation = computeRecommendation({
    score,
    rating,
    promotionReady,
    evaluatedCount,
    minSignals,
  });

  return {
    strategyId: strategy.id,
    strategyName: strategy.name,
    status: strategy.status,
    signalCount: signals.length,
    openCount,
    closedCount,
    expiredCount,
    winCount: outcomes.winCount,
    lossCount: outcomes.lossCount,
    flatCount: outcomes.flatCount,
    insufficientCount: outcomes.insufficientCount,
    pendingCount: outcomes.pendingCount,
    evaluatedCount,
    winRate,
    avgCurrentPct: average(signals.map((s) => s.currentResultPct)),
    avg1dPct: average(signals.map((s) => s.result1dPct)),
    avg7dPct: average(signals.map((s) => s.result7dPct)),
    avg30dPct,
    worstMaePct: minValue(signals.map((s) => s.maePct)),
    avgMaeMfeRatio,
    ruleFollowedPct,
    score,
    rating,
    recommendation,
    promotionReady,
    promotionBlockers,
  };
}

export async function syncStrategyEvaluations(): Promise<{ updated: number }> {
  const strategies = await prisma.strategy.findMany({
    where: { status: { in: ["PAPER_ACTIVE", "PROMOTED"] } },
    include: { paperSignals: true },
  });

  let updated = 0;
  const now = new Date();

  for (const strategy of strategies) {
    if (strategy.paperSignals.length === 0) continue;

    const ranking = buildStrategyRanking(
      { id: strategy.id, name: strategy.name, status: strategy.status },
      strategy.paperSignals,
    );

    await prisma.strategy.update({
      where: { id: strategy.id },
      data: {
        evaluationScore: ranking.score,
        rating: ranking.rating,
        lastEvaluatedAt: now,
      },
    });
    updated += 1;
  }

  return { updated };
}

export async function getPaperStrategyRankings(): Promise<
  PaperStrategyRanking[]
> {
  const strategies = await prisma.strategy.findMany({
    where: {
      status: { in: ["PAPER_ACTIVE", "PROMOTED", "REJECTED"] },
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
    if (b.score !== a.score) return b.score - a.score;
    const a30 = a.avg30dPct ?? -Infinity;
    const b30 = b.avg30dPct ?? -Infinity;
    if (b30 !== a30) return b30 - a30;
    const aWin = a.winRate ?? 0;
    const bWin = b.winRate ?? 0;
    return bWin - aWin;
  });

  return rankings;
}
