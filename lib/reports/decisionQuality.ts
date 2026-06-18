import type { JournalQualitySummary } from "@/lib/journal";

export function computeDecisionQualityScore(
  summary: JournalQualitySummary,
): number {
  const windowTotal =
    summary.levelCounts.GREEN +
    summary.levelCounts.YELLOW +
    summary.levelCounts.RED;
  const greenRatio =
    windowTotal > 0 ? (summary.levelCounts.GREEN / windowTotal) * 100 : 0;

  const emotionPenalty =
    summary.avgEmotionScore >= 8 ? 15 : summary.avgEmotionScore >= 6 ? 5 : 0;

  const score =
    summary.completePct * 0.35 +
    summary.plannedPct * 0.25 +
    greenRatio * 0.4 -
    emotionPenalty;

  return Math.max(0, Math.min(100, Math.round(score)));
}
