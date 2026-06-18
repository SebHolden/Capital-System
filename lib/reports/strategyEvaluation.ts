import type { StrategyRating } from "@prisma/client";
import { getPaperStrategyRankings } from "@/lib/paper-signals";

export interface StrategyEvaluationReport {
  type: "strategy";
  generatedAt: string;
  totalStrategies: number;
  byRating: Record<StrategyRating, number>;
  bestByScore: Array<{
    strategyId: string;
    name: string;
    score: number;
    rating: StrategyRating;
    winRate: number | null;
  }>;
  worstByScore: Array<{
    strategyId: string;
    name: string;
    score: number;
    rating: StrategyRating;
    winRate: number | null;
  }>;
  mostVolatile: Array<{
    strategyId: string;
    name: string;
    worstMaePct: number;
  }>;
  mostReliable: Array<{
    strategyId: string;
    name: string;
    ruleFollowedPct: number;
    winRate: number;
  }>;
  insufficientData: Array<{
    strategyId: string;
    name: string;
    reason: string;
  }>;
  warnings: string[];
}

const EMPTY_RATINGS: Record<StrategyRating, number> = {
  POOR: 0,
  WEAK: 0,
  WATCH: 0,
  GOOD: 0,
  PROMOTABLE: 0,
};

export async function buildStrategyEvaluationReport(): Promise<StrategyEvaluationReport> {
  const rankings = await getPaperStrategyRankings();
  const byRating = { ...EMPTY_RATINGS };

  for (const ranking of rankings) {
    byRating[ranking.rating] += 1;
  }

  const sortedByScore = [...rankings].sort((a, b) => b.score - a.score);
  const bestByScore = sortedByScore.slice(0, 5).map((r) => ({
    strategyId: r.strategyId,
    name: r.strategyName,
    score: r.score,
    rating: r.rating,
    winRate: r.winRate,
  }));

  const worstByScore = [...rankings]
    .sort((a, b) => a.score - b.score)
    .slice(0, 5)
    .map((r) => ({
      strategyId: r.strategyId,
      name: r.strategyName,
      score: r.score,
      rating: r.rating,
      winRate: r.winRate,
    }));

  const mostVolatile = [...rankings]
    .filter((r) => r.worstMaePct !== null)
    .sort((a, b) => (a.worstMaePct ?? 0) - (b.worstMaePct ?? 0))
    .slice(0, 5)
    .map((r) => ({
      strategyId: r.strategyId,
      name: r.strategyName,
      worstMaePct: r.worstMaePct ?? 0,
    }));

  const mostReliable = [...rankings]
    .filter((r) => r.winRate !== null && r.ruleFollowedPct !== null)
    .sort((a, b) => {
      const aRel = (a.winRate ?? 0) + (a.ruleFollowedPct ?? 0);
      const bRel = (b.winRate ?? 0) + (b.ruleFollowedPct ?? 0);
      return bRel - aRel;
    })
    .slice(0, 5)
    .map((r) => ({
      strategyId: r.strategyId,
      name: r.strategyName,
      ruleFollowedPct: r.ruleFollowedPct ?? 0,
      winRate: r.winRate ?? 0,
    }));

  const insufficientData = rankings
    .filter((r) => r.recommendation === "INSUFFICIENT_DATA")
    .map((r) => ({
      strategyId: r.strategyId,
      name: r.strategyName,
      reason:
        r.promotionBlockers[0] ??
        `Solo ${r.evaluatedCount} segnali valutati su ${r.signalCount}.`,
    }));

  const warnings: string[] = [];

  for (const ranking of rankings) {
    const flatRatio =
      ranking.signalCount > 0 ? ranking.flatCount / ranking.signalCount : 0;
    if (flatRatio > 0.5) {
      warnings.push(
        `${ranking.strategyName}: oltre il 50% dei segnali è FLAT (${(flatRatio * 100).toFixed(0)}%).`,
      );
    }
    if (ranking.evaluatedCount === 0) {
      warnings.push(
        `${ranking.strategyName}: nessun segnale valutato — dati insufficienti.`,
      );
    }
    if (ranking.status === "REJECTED") {
      warnings.push(
        `${ranking.strategyName}: strategia degradata (rating ${ranking.rating}).`,
      );
    }
    if (ranking.openCount > 10) {
      warnings.push(
        `${ranking.strategyName}: ${ranking.openCount} segnali OPEN — possibile overtrading.`,
      );
    }
  }

  return {
    type: "strategy",
    generatedAt: new Date().toISOString(),
    totalStrategies: rankings.length,
    byRating,
    bestByScore,
    worstByScore,
    mostVolatile,
    mostReliable,
    insufficientData,
    warnings,
  };
}
