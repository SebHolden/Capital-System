import type { PaperStrategyRanking } from "./rankings";

export interface DegradationRule {
  check: (ranking: PaperStrategyRanking) => boolean;
  reason: string;
}

export const DEGRADATION_RULES: DegradationRule[] = [
  {
    check: (r) => r.signalCount > 0 && r.score < 30,
    reason: "Score sotto 30",
  },
  {
    check: (r) => {
      const evaluated = r.winCount + r.lossCount + r.flatCount;
      return evaluated > 0 && r.lossCount / evaluated > 0.6;
    },
    reason: "Loss rate > 60%",
  },
  {
    check: (r) => r.worstMaePct !== null && r.worstMaePct < -20,
    reason: "MAE estremo",
  },
  {
    check: (r) => r.avg30dPct !== null && r.avg30dPct < -5,
    reason: "Avg 30d negativo",
  },
  {
    check: (r) =>
      r.signalCount > 0 &&
      (r.expiredCount + r.insufficientCount) / r.signalCount > 0.4,
    reason: "Troppi segnali non valutabili",
  },
];

export function shouldDegrade(ranking: PaperStrategyRanking): {
  degrade: boolean;
  reasons: string[];
} {
  const reasons = DEGRADATION_RULES.filter((rule) => rule.check(ranking)).map(
    (rule) => rule.reason,
  );

  return {
    degrade: reasons.length > 0,
    reasons,
  };
}
