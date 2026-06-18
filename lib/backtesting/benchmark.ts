import type { PriceBar } from "@/lib/prices/history";
import type { EquityPoint, PerformanceMetrics } from "./types";
import { computeMetrics } from "./metrics";

export function runBuyAndHoldBenchmark(
  bars: PriceBar[],
  initialCapital: number,
): { equityCurve: EquityPoint[]; metrics: PerformanceMetrics } {
  if (bars.length === 0) {
    return {
      equityCurve: [],
      metrics: computeMetrics([], initialCapital, 0, 0, 0),
    };
  }

  const startPrice = bars[0].close;
  const quantity = startPrice > 0 ? initialCapital / startPrice : 0;

  const equityCurve: EquityPoint[] = bars.map((bar) => ({
    date: bar.date,
    value: quantity * bar.close,
  }));

  return {
    equityCurve,
    metrics: computeMetrics(equityCurve, initialCapital, 1, 1, bars.length),
  };
}
