import type { StrategyRating } from "@prisma/client";

export interface StrategyScoreInput {
  winCount: number;
  lossCount: number;
  flatCount: number;
  expiredCount: number;
  insufficientCount: number;
  pendingCount: number;
  avg7dPct: number | null;
  avg30dPct: number | null;
  worstMaePct: number | null;
  avgMaeMfeRatio: number | null;
  ruleFollowedPct: number | null;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function normalizeReturnScore(avg30dPct: number | null): number {
  if (avg30dPct === null) return 0;
  // Map -10%..+10% to 0..25
  const normalized = ((avg30dPct + 10) / 20) * 25;
  return clamp(normalized, 0, 25);
}

function normalizeMaeMfeScore(ratio: number | null): number {
  if (ratio === null) return 7.5;
  // Lower adverse/favorable ratio is better; cap at 15 points
  const score = 15 - Math.min(15, Math.max(0, ratio * 5));
  return clamp(score, 0, 15);
}

export function computeStrategyScore(input: StrategyScoreInput): number {
  const evaluatedCount =
    input.winCount +
    input.lossCount +
    input.flatCount +
    input.expiredCount +
    input.insufficientCount;

  if (evaluatedCount === 0 && input.pendingCount === 0) {
    return 0;
  }

  const decisiveCount = input.winCount + input.lossCount + input.flatCount;
  const winRateScore =
    decisiveCount > 0 ? (input.winCount / decisiveCount) * 40 : 0;

  const returnScore = normalizeReturnScore(input.avg30dPct);
  const maeMfeScore = normalizeMaeMfeScore(input.avgMaeMfeRatio);
  const ruleScore =
    input.ruleFollowedPct !== null ? (input.ruleFollowedPct / 100) * 10 : 5;

  const totalSignals =
    evaluatedCount + input.pendingCount > 0
      ? evaluatedCount + input.pendingCount
      : 1;
  const badDataRatio =
    (input.expiredCount + input.insufficientCount) / totalSignals;
  const dataQualityScore = (1 - badDataRatio) * 10;

  const raw =
    winRateScore + returnScore + maeMfeScore + ruleScore + dataQualityScore;

  return Math.round(clamp(raw, 0, 100));
}

export function computeRating(score: number): StrategyRating {
  if (score >= 81) return "PROMOTABLE";
  if (score >= 61) return "GOOD";
  if (score >= 41) return "WATCH";
  if (score >= 21) return "WEAK";
  return "POOR";
}

export type StrategyRecommendation =
  | "PROMOTE"
  | "WATCH"
  | "DEGRADE"
  | "INSUFFICIENT_DATA";

export function computeRecommendation(input: {
  score: number;
  rating: StrategyRating;
  promotionReady: boolean;
  evaluatedCount: number;
  minSignals: number;
}): StrategyRecommendation {
  if (input.evaluatedCount < input.minSignals) {
    return "INSUFFICIENT_DATA";
  }
  if (input.promotionReady && input.rating === "PROMOTABLE") {
    return "PROMOTE";
  }
  if (input.rating === "POOR" || input.rating === "WEAK") {
    return "DEGRADE";
  }
  return "WATCH";
}
