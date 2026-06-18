import { describe, expect, it } from "vitest";
import { shouldDegrade } from "./degradation";
import type { PaperStrategyRanking } from "./rankings";

function baseRanking(
  overrides: Partial<PaperStrategyRanking> = {},
): PaperStrategyRanking {
  return {
    strategyId: "s1",
    strategyName: "Test",
    status: "PAPER_ACTIVE",
    signalCount: 10,
    openCount: 2,
    closedCount: 6,
    expiredCount: 1,
    winCount: 5,
    lossCount: 3,
    flatCount: 2,
    insufficientCount: 0,
    pendingCount: 0,
    evaluatedCount: 10,
    winRate: 50,
    avgCurrentPct: 1,
    avg1dPct: 0.5,
    avg7dPct: 1,
    avg30dPct: 2,
    worstMaePct: -5,
    avgMaeMfeRatio: 0.5,
    ruleFollowedPct: 90,
    score: 65,
    rating: "GOOD",
    recommendation: "WATCH",
    promotionReady: false,
    promotionBlockers: [],
    ...overrides,
  };
}

describe("shouldDegrade", () => {
  it("does not degrade GOOD strategy", () => {
    const result = shouldDegrade(baseRanking());
    expect(result.degrade).toBe(false);
  });

  it("degrades on low score", () => {
    const result = shouldDegrade(baseRanking({ score: 20, rating: "POOR" }));
    expect(result.degrade).toBe(true);
    expect(result.reasons).toContain("Score sotto 30");
  });

  it("degrades on high loss rate", () => {
    const result = shouldDegrade(
      baseRanking({
        winCount: 1,
        lossCount: 7,
        flatCount: 2,
        score: 25,
        rating: "WEAK",
      }),
    );
    expect(result.degrade).toBe(true);
    expect(result.reasons.some((r) => r.includes("Loss rate"))).toBe(true);
  });

  it("degrades on extreme MAE", () => {
    const result = shouldDegrade(
      baseRanking({ worstMaePct: -25, score: 25, rating: "WEAK" }),
    );
    expect(result.degrade).toBe(true);
    expect(result.reasons).toContain("MAE estremo");
  });

  it("degrades on negative avg 30d", () => {
    const result = shouldDegrade(
      baseRanking({ avg30dPct: -8, score: 25, rating: "WEAK" }),
    );
    expect(result.degrade).toBe(true);
    expect(result.reasons).toContain("Avg 30d negativo");
  });

  it("degrades on too many unevaluable signals", () => {
    const result = shouldDegrade(
      baseRanking({
        signalCount: 10,
        expiredCount: 3,
        insufficientCount: 2,
        score: 25,
        rating: "WEAK",
      }),
    );
    expect(result.degrade).toBe(true);
    expect(result.reasons.some((r) => r.includes("non valutabili"))).toBe(true);
  });
});

describe("promotion does not enable live trading", () => {
  it("degradation only changes strategy status to REJECTED analytically", () => {
    const ranking = baseRanking({ score: 10, rating: "POOR" });
    const { degrade } = shouldDegrade(ranking);
    expect(degrade).toBe(true);
    expect(ranking.status).toBe("PAPER_ACTIVE");
  });
});
