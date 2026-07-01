import { describe, it, expect } from "vitest";
import {
  computeDegradation,
  computeConsistency,
  computeFoldStability,
  analyzeOverfit,
  analyzeParameterSensitivity,
} from "./overfit";
import type { WalkForwardResult, WalkForwardFold } from "./walkForward";
import type { PerformanceMetrics } from "./types";

function createMetrics(totalReturnPct: number): PerformanceMetrics {
  return {
    totalReturnPct,
    cagrPct: totalReturnPct / 2,
    volatilityPct: 15,
    maxDrawdownPct: 10,
    sharpeRatio: 1.0,
    sortinoRatio: 1.2,
    winRatePct: 55,
    tradeCount: 10,
    avgHoldingDays: 5,
    worstMonthPct: -5,
    bestMonthPct: 8,
    recoveryDays: 30,
    finalValue: 11000,
  };
}

function createFold(
  inSampleReturn: number,
  outOfSampleReturn: number,
): WalkForwardFold {
  return {
    foldIndex: 1,
    trainStartDate: "2024-01-01",
    trainEndDate: "2024-06-30",
    testStartDate: "2024-07-01",
    testEndDate: "2024-09-30",
    inSample: createMetrics(inSampleReturn),
    outOfSample: createMetrics(outOfSampleReturn),
  };
}

describe("computeDegradation", () => {
  it("returns 0 for identical performance", () => {
    const degradation = computeDegradation(10, 10);
    expect(degradation).toBe(0);
  });

  it("returns positive value when OOS is worse", () => {
    const degradation = computeDegradation(10, 5);
    expect(degradation).toBeCloseTo(0.5);
  });

  it("returns 0 when OOS is better (no degradation)", () => {
    const degradation = computeDegradation(10, 15);
    expect(degradation).toBe(0);
  });

  it("handles zero in-sample return", () => {
    const degradation = computeDegradation(0, 5);
    expect(degradation).toBe(0);
  });

  it("caps at 1 for extreme degradation", () => {
    const degradation = computeDegradation(10, -10);
    expect(degradation).toBe(1);
  });
});

describe("computeConsistency", () => {
  it("returns high consistency for stable returns", () => {
    const folds = [
      createFold(10, 8),
      createFold(10, 9),
      createFold(10, 8.5),
    ];
    const consistency = computeConsistency(folds);
    expect(consistency).toBeGreaterThan(0.8);
  });

  it("returns low consistency for volatile returns", () => {
    const folds = [
      createFold(10, 20),
      createFold(10, -5),
      createFold(10, 15),
      createFold(10, -10),
    ];
    const consistency = computeConsistency(folds);
    expect(consistency).toBeLessThan(0.5);
  });

  it("handles single fold", () => {
    const folds = [createFold(10, 8)];
    const consistency = computeConsistency(folds);
    expect(consistency).toBe(0);
  });

  it("handles empty folds", () => {
    const consistency = computeConsistency([]);
    expect(consistency).toBe(0);
  });
});

describe("computeFoldStability", () => {
  it("returns 1 when all folds are positive", () => {
    const folds = [
      createFold(10, 5),
      createFold(10, 3),
      createFold(10, 8),
    ];
    const stability = computeFoldStability(folds);
    expect(stability).toBe(1);
  });

  it("returns 0 when all folds are negative", () => {
    const folds = [
      createFold(10, -5),
      createFold(10, -3),
      createFold(10, -8),
    ];
    const stability = computeFoldStability(folds);
    expect(stability).toBe(0);
  });

  it("returns proportion for mixed folds", () => {
    const folds = [
      createFold(10, 5),
      createFold(10, -3),
      createFold(10, 8),
      createFold(10, -2),
    ];
    const stability = computeFoldStability(folds);
    expect(stability).toBe(0.5);
  });

  it("handles empty folds", () => {
    const stability = computeFoldStability([]);
    expect(stability).toBe(0);
  });
});

describe("analyzeOverfit", () => {
  it("returns SAFE for well-performing strategy", () => {
    const result: WalkForwardResult = {
      folds: [
        createFold(10, 9),
        createFold(12, 11),
        createFold(8, 7),
      ],
      aggregate: {
        foldCount: 3,
        avgInSampleReturnPct: 10,
        avgOutOfSampleReturnPct: 9,
        avgInSampleMaxDrawdownPct: 5,
        avgOutOfSampleMaxDrawdownPct: 6,
      },
    };

    const analysis = analyzeOverfit(result);
    expect(analysis.recommendation).toBe("SAFE");
    expect(analysis.overfitScore).toBeLessThan(0.3);
  });

  it("returns REJECT for severe overfit", () => {
    const result: WalkForwardResult = {
      folds: [
        createFold(20, -5),
        createFold(25, -8),
        createFold(18, -3),
      ],
      aggregate: {
        foldCount: 3,
        avgInSampleReturnPct: 21,
        avgOutOfSampleReturnPct: -5.3,
        avgInSampleMaxDrawdownPct: 5,
        avgOutOfSampleMaxDrawdownPct: 15,
      },
    };

    const analysis = analyzeOverfit(result);
    expect(analysis.recommendation).toBe("REJECT");
    expect(analysis.warnings.length).toBeGreaterThan(0);
  });

  it("returns CAUTION for moderate issues", () => {
    const result: WalkForwardResult = {
      folds: [
        createFold(15, 8),
        createFold(12, 5),
        createFold(10, 3),
      ],
      aggregate: {
        foldCount: 3,
        avgInSampleReturnPct: 12.3,
        avgOutOfSampleReturnPct: 5.3,
        avgInSampleMaxDrawdownPct: 5,
        avgOutOfSampleMaxDrawdownPct: 8,
      },
    };

    const analysis = analyzeOverfit(result);
    expect(["CAUTION", "HIGH_RISK"]).toContain(analysis.recommendation);
  });

  it("handles empty walk-forward result", () => {
    const result: WalkForwardResult = {
      folds: [],
      aggregate: null,
    };

    const analysis = analyzeOverfit(result);
    expect(analysis.recommendation).toBe("REJECT");
    expect(analysis.overfitScore).toBe(1);
  });
});

describe("analyzeParameterSensitivity", () => {
  it("returns low sensitivity for stable results", () => {
    const base = createMetrics(10);
    const perturbed = [
      createMetrics(9.5),
      createMetrics(10.5),
      createMetrics(9.8),
    ];

    const analysis = analyzeParameterSensitivity(base, perturbed);
    expect(analysis.sensitivityScore).toBeLessThan(0.2);
  });

  it("returns high sensitivity for volatile results", () => {
    const base = createMetrics(10);
    const perturbed = [
      createMetrics(2),
      createMetrics(20),
      createMetrics(-5),
    ];

    const analysis = analyzeParameterSensitivity(base, perturbed);
    expect(analysis.sensitivityScore).toBeGreaterThan(0.5);
    expect(analysis.warnings.length).toBeGreaterThan(0);
  });

  it("handles empty perturbed array", () => {
    const base = createMetrics(10);
    const analysis = analyzeParameterSensitivity(base, []);
    expect(analysis.sensitivityScore).toBe(0);
  });
});
