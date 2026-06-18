import type { PriceBar } from "@/lib/prices/history";
import type { PerformanceMetrics } from "./types";

export interface WalkForwardFold {
  foldIndex: number;
  trainStartDate: string;
  trainEndDate: string;
  testStartDate: string;
  testEndDate: string;
  inSample: PerformanceMetrics;
  outOfSample: PerformanceMetrics;
}

export interface WalkForwardAggregate {
  foldCount: number;
  avgInSampleReturnPct: number;
  avgOutOfSampleReturnPct: number;
  avgInSampleMaxDrawdownPct: number;
  avgOutOfSampleMaxDrawdownPct: number;
}

export interface WalkForwardResult {
  folds: WalkForwardFold[];
  aggregate: WalkForwardAggregate | null;
}

export function sliceWalkForwardFolds(
  bars: PriceBar[],
  trainBars: number,
  testBars: number,
  stepBars: number,
): Array<{ train: PriceBar[]; test: PriceBar[] }> {
  const folds: Array<{ train: PriceBar[]; test: PriceBar[] }> = [];
  let start = 0;

  while (start + trainBars + testBars <= bars.length) {
    folds.push({
      train: bars.slice(start, start + trainBars),
      test: bars.slice(start + trainBars, start + trainBars + testBars),
    });
    start += stepBars;
  }

  return folds;
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function aggregateWalkForwardFolds(
  folds: WalkForwardFold[],
): WalkForwardAggregate | null {
  if (folds.length === 0) return null;

  return {
    foldCount: folds.length,
    avgInSampleReturnPct: average(
      folds.map((f) => f.inSample.totalReturnPct),
    ),
    avgOutOfSampleReturnPct: average(
      folds.map((f) => f.outOfSample.totalReturnPct),
    ),
    avgInSampleMaxDrawdownPct: average(
      folds.map((f) => f.inSample.maxDrawdownPct),
    ),
    avgOutOfSampleMaxDrawdownPct: average(
      folds.map((f) => f.outOfSample.maxDrawdownPct),
    ),
  };
}

export function runWalkForward(input: {
  bars: PriceBar[];
  trainBars: number;
  testBars: number;
  stepBars: number;
  evaluateFold: (train: PriceBar[], test: PriceBar[]) => {
    inSample: PerformanceMetrics;
    outOfSample: PerformanceMetrics;
  };
}): WalkForwardResult {
  const slices = sliceWalkForwardFolds(
    input.bars,
    input.trainBars,
    input.testBars,
    input.stepBars,
  );

  const folds: WalkForwardFold[] = slices.map((slice, index) => {
    const metrics = input.evaluateFold(slice.train, slice.test);
    return {
      foldIndex: index + 1,
      trainStartDate: slice.train[0]?.date ?? "",
      trainEndDate: slice.train[slice.train.length - 1]?.date ?? "",
      testStartDate: slice.test[0]?.date ?? "",
      testEndDate: slice.test[slice.test.length - 1]?.date ?? "",
      inSample: metrics.inSample,
      outOfSample: metrics.outOfSample,
    };
  });

  return {
    folds,
    aggregate: aggregateWalkForwardFolds(folds),
  };
}
