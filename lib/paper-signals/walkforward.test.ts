import { describe, it, expect } from "vitest";
import {
  computeWalkForwardScore,
  computeOverfitScore,
  getWalkForwardMinScore,
  getWalkForwardTrainBars,
  getWalkForwardTestBars,
  getWalkForwardStepBars,
} from "./walkforward";
import type { WalkForwardResult, WalkForwardFold } from "@/lib/backtesting/walkForward";
import type { PerformanceMetrics } from "@/lib/backtesting/types";

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

describe("computeWalkForwardScore", () => {
  it("returns 0 for empty results", () => {
    const result: WalkForwardResult = {
      folds: [],
      aggregate: null,
    };
    expect(computeWalkForwardScore(result)).toBe(0);
  });

  it("returns ratio of OOS to IS when OOS is positive", () => {
    const result: WalkForwardResult = {
      folds: [createFold(10, 8), createFold(10, 8), createFold(10, 8)],
      aggregate: {
        foldCount: 3,
        avgInSampleReturnPct: 10,
        avgOutOfSampleReturnPct: 8,
        avgInSampleMaxDrawdownPct: 5,
        avgOutOfSampleMaxDrawdownPct: 6,
      },
    };
    const score = computeWalkForwardScore(result);
    expect(score).toBeCloseTo(0.8);
  });

  it("returns 0 when IS return is zero or negative", () => {
    const result: WalkForwardResult = {
      folds: [createFold(0, 8)],
      aggregate: {
        foldCount: 1,
        avgInSampleReturnPct: 0,
        avgOutOfSampleReturnPct: 8,
        avgInSampleMaxDrawdownPct: 5,
        avgOutOfSampleMaxDrawdownPct: 6,
      },
    };
    expect(computeWalkForwardScore(result)).toBe(0);
  });

  it("returns 0 when OOS return is negative", () => {
    const result: WalkForwardResult = {
      folds: [createFold(10, -5)],
      aggregate: {
        foldCount: 1,
        avgInSampleReturnPct: 10,
        avgOutOfSampleReturnPct: -5,
        avgInSampleMaxDrawdownPct: 5,
        avgOutOfSampleMaxDrawdownPct: 15,
      },
    };
    expect(computeWalkForwardScore(result)).toBe(0);
  });

  it("caps at 1 when OOS exceeds IS", () => {
    const result: WalkForwardResult = {
      folds: [createFold(10, 15), createFold(10, 15)],
      aggregate: {
        foldCount: 2,
        avgInSampleReturnPct: 10,
        avgOutOfSampleReturnPct: 15,
        avgInSampleMaxDrawdownPct: 5,
        avgOutOfSampleMaxDrawdownPct: 4,
      },
    };
    expect(computeWalkForwardScore(result)).toBe(1);
  });
});

describe("computeOverfitScore", () => {
  it("returns 0 for perfect consistency", () => {
    const result: WalkForwardResult = {
      folds: [createFold(10, 10), createFold(10, 10)],
      aggregate: {
        foldCount: 2,
        avgInSampleReturnPct: 10,
        avgOutOfSampleReturnPct: 10,
        avgInSampleMaxDrawdownPct: 5,
        avgOutOfSampleMaxDrawdownPct: 5,
      },
    };
    expect(computeOverfitScore(result)).toBe(0);
  });

  it("returns high score for severe degradation", () => {
    const result: WalkForwardResult = {
      folds: [createFold(20, 2), createFold(20, 2)],
      aggregate: {
        foldCount: 2,
        avgInSampleReturnPct: 20,
        avgOutOfSampleReturnPct: 2,
        avgInSampleMaxDrawdownPct: 5,
        avgOutOfSampleMaxDrawdownPct: 15,
      },
    };
    const score = computeOverfitScore(result);
    expect(score).toBeCloseTo(0.9);
  });

  it("caps at 1", () => {
    const result: WalkForwardResult = {
      folds: [createFold(20, -10)],
      aggregate: {
        foldCount: 1,
        avgInSampleReturnPct: 20,
        avgOutOfSampleReturnPct: -10,
        avgInSampleMaxDrawdownPct: 5,
        avgOutOfSampleMaxDrawdownPct: 25,
      },
    };
    expect(computeOverfitScore(result)).toBe(1);
  });

  it("returns 1 for no aggregate", () => {
    const result: WalkForwardResult = {
      folds: [],
      aggregate: null,
    };
    expect(computeOverfitScore(result)).toBe(1);
  });
});

describe("environment configuration", () => {
  it("returns default values for walk-forward params", () => {
    expect(getWalkForwardMinScore()).toBeGreaterThan(0);
    expect(getWalkForwardMinScore()).toBeLessThanOrEqual(1);
    expect(getWalkForwardTrainBars()).toBeGreaterThan(0);
    expect(getWalkForwardTestBars()).toBeGreaterThan(0);
    expect(getWalkForwardStepBars()).toBeGreaterThan(0);
  });
});
