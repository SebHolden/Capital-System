import { describe, expect, it } from "vitest";
import {
  computeRating,
  computeRecommendation,
  computeStrategyScore,
} from "./scoring";

describe("computeStrategyScore", () => {
  it("returns high score for strong strategy", () => {
    const score = computeStrategyScore({
      winCount: 8,
      lossCount: 2,
      flatCount: 0,
      expiredCount: 0,
      insufficientCount: 0,
      pendingCount: 0,
      avg7dPct: 2,
      avg30dPct: 5,
      worstMaePct: -3,
      avgMaeMfeRatio: 0.3,
      ruleFollowedPct: 100,
    });
    expect(score).toBeGreaterThanOrEqual(70);
  });

  it("returns low score for poor strategy", () => {
    const score = computeStrategyScore({
      winCount: 1,
      lossCount: 8,
      flatCount: 1,
      expiredCount: 2,
      insufficientCount: 3,
      pendingCount: 0,
      avg7dPct: -2,
      avg30dPct: -8,
      worstMaePct: -25,
      avgMaeMfeRatio: 2,
      ruleFollowedPct: 40,
    });
    expect(score).toBeLessThan(40);
  });

  it("returns 0 with no signals", () => {
    expect(
      computeStrategyScore({
        winCount: 0,
        lossCount: 0,
        flatCount: 0,
        expiredCount: 0,
        insufficientCount: 0,
        pendingCount: 0,
        avg7dPct: null,
        avg30dPct: null,
        worstMaePct: null,
        avgMaeMfeRatio: null,
        ruleFollowedPct: null,
      }),
    ).toBe(0);
  });
});

describe("computeRating", () => {
  it("maps score to rating tiers", () => {
    expect(computeRating(90)).toBe("PROMOTABLE");
    expect(computeRating(70)).toBe("GOOD");
    expect(computeRating(50)).toBe("WATCH");
    expect(computeRating(30)).toBe("WEAK");
    expect(computeRating(10)).toBe("POOR");
  });
});

describe("computeRecommendation", () => {
  it("recommends PROMOTE when ready and PROMOTABLE", () => {
    expect(
      computeRecommendation({
        score: 85,
        rating: "PROMOTABLE",
        promotionReady: true,
        evaluatedCount: 5,
        minSignals: 3,
      }),
    ).toBe("PROMOTE");
  });

  it("recommends INSUFFICIENT_DATA when too few evaluated", () => {
    expect(
      computeRecommendation({
        score: 50,
        rating: "WATCH",
        promotionReady: false,
        evaluatedCount: 1,
        minSignals: 3,
      }),
    ).toBe("INSUFFICIENT_DATA");
  });

  it("recommends DEGRADE for POOR rating", () => {
    expect(
      computeRecommendation({
        score: 15,
        rating: "POOR",
        promotionReady: false,
        evaluatedCount: 5,
        minSignals: 3,
      }),
    ).toBe("DEGRADE");
  });
});
