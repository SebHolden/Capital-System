import { describe, expect, it } from "vitest";
import { computeDecisionQualityScore } from "./decisionQuality";
import type { JournalQualitySummary } from "@/lib/journal";

function baseSummary(
  overrides: Partial<JournalQualitySummary> = {},
): JournalQualitySummary {
  return {
    total: 10,
    completeCount: 8,
    completePct: 80,
    avgEmotionScore: 4,
    avgConfidenceScore: 7,
    plannedPct: 70,
    levelCounts: { GREEN: 6, YELLOW: 3, RED: 1 },
    ...overrides,
  };
}

describe("computeDecisionQualityScore", () => {
  it("rewards complete planned journals with low emotion", () => {
    const score = computeDecisionQualityScore(baseSummary());
    expect(score).toBeGreaterThan(60);
  });

  it("penalizes high emotion scores", () => {
    const calm = computeDecisionQualityScore(baseSummary({ avgEmotionScore: 4 }));
    const stressed = computeDecisionQualityScore(
      baseSummary({ avgEmotionScore: 8 }),
    );
    expect(stressed).toBeLessThan(calm);
  });

  it("returns 0-100 bounded score", () => {
    const score = computeDecisionQualityScore(
      baseSummary({
        completePct: 0,
        plannedPct: 0,
        levelCounts: { GREEN: 0, YELLOW: 0, RED: 10 },
        avgEmotionScore: 10,
      }),
    );
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });
});
