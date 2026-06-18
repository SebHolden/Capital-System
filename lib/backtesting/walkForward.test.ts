import { describe, expect, it } from "vitest";
import type { PriceBar } from "@/lib/prices/history";
import type { PerformanceMetrics } from "./types";
import {
  aggregateWalkForwardFolds,
  runWalkForward,
  sliceWalkForwardFolds,
} from "./walkForward";

function syntheticBars(count: number): PriceBar[] {
  const bars: PriceBar[] = [];
  const start = new Date("2024-01-01");
  for (let i = 0; i < count; i++) {
    const d = new Date(start);
    d.setUTCDate(d.getUTCDate() + i);
    bars.push({
      date: d.toISOString().slice(0, 10),
      close: 100 + i,
    });
  }
  return bars;
}

function mockMetrics(returnPct: number): PerformanceMetrics {
  return {
    totalReturnPct: returnPct,
    cagrPct: returnPct,
    volatilityPct: 10,
    maxDrawdownPct: 5,
    sharpeRatio: 1,
    sortinoRatio: 1,
    winRatePct: 50,
    tradeCount: 2,
    avgHoldingDays: 5,
    worstMonthPct: -2,
    bestMonthPct: 3,
    recoveryDays: null,
    finalValue: 10000 * (1 + returnPct / 100),
  };
}

describe("sliceWalkForwardFolds", () => {
  it("creates rolling folds with train/test/step", () => {
    const bars = syntheticBars(150);
    const folds = sliceWalkForwardFolds(bars, 60, 30, 30);
    expect(folds.length).toBeGreaterThan(0);
    expect(folds[0].train).toHaveLength(60);
    expect(folds[0].test).toHaveLength(30);
  });
});

describe("runWalkForward", () => {
  it("returns folds and aggregate metrics", () => {
    const bars = syntheticBars(150);
    const result = runWalkForward({
      bars,
      trainBars: 60,
      testBars: 30,
      stepBars: 30,
      evaluateFold: (train, test) => ({
        inSample: mockMetrics(train.length / 10),
        outOfSample: mockMetrics(test.length / 20),
      }),
    });

    expect(result.folds.length).toBeGreaterThan(0);
    expect(result.aggregate).not.toBeNull();
    expect(result.aggregate!.foldCount).toBe(result.folds.length);
  });
});

describe("aggregateWalkForwardFolds", () => {
  it("returns null for empty folds", () => {
    expect(aggregateWalkForwardFolds([])).toBeNull();
  });
});
