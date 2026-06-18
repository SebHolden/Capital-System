import { describe, expect, it } from "vitest";
import { computeSignalMetrics } from "./metrics";

describe("computeSignalMetrics", () => {
  const signalDate = new Date("2026-01-01T12:00:00.000Z");
  const bars = Array.from({ length: 35 }, (_, i) => {
    const day = i + 1;
    const date = `2026-01-${String(day).padStart(2, "0")}`;
    return {
      date,
      open: 100 + i,
      high: 100 + i,
      low: 100 + i,
      close: 100 + i,
    };
  });

  it("computes current, 1d, 7d, 30d and MAE/MFE for BUY", () => {
    const metrics = computeSignalMetrics({
      signalType: "BUY",
      plannedEntry: 100,
      signalDate,
      bars,
      currentPrice: 134,
    });

    expect(metrics.currentResultPct).toBeCloseTo(34);
    expect(metrics.result1dPct).toBeCloseTo(1);
    expect(metrics.result7dPct).toBeCloseTo(7);
    expect(metrics.result30dPct).toBeCloseTo(30);
    expect(metrics.maePct).toBeCloseTo(0);
    expect(metrics.mfePct).toBeCloseTo(34);
  });

  it("returns null horizon results when bars are missing", () => {
    const metrics = computeSignalMetrics({
      signalType: "BUY",
      plannedEntry: 100,
      signalDate,
      bars: bars.slice(0, 2),
      currentPrice: 101,
    });

    expect(metrics.result30dPct).toBeNull();
    expect(metrics.result7dPct).toBeNull();
  });
});
