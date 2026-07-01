import { describe, it, expect } from "vitest";
import {
  detectGaps,
  detectOutliers,
  computeCompleteness,
  computeQualityScore,
  validateDataQuality,
} from "./validation";
import type { PriceBar, PriceHistoryResult } from "@/lib/prices/history";

function buildBars(start: Date, count: number, gapDays: number[] = []): PriceBar[] {
  const bars: PriceBar[] = [];
  let dayOffset = 0;

  for (let i = 0; i < count; i++) {
    while (gapDays.includes(dayOffset)) {
      dayOffset++;
    }
    const date = new Date(start);
    date.setUTCDate(date.getUTCDate() + dayOffset);
    bars.push({
      date: date.toISOString().slice(0, 10),
      close: 100 + i,
    });
    dayOffset++;
  }

  return bars;
}

describe("detectGaps", () => {
  it("returns empty for continuous data", () => {
    const bars = buildBars(new Date("2025-01-01"), 10);
    const gaps = detectGaps(bars, 0, true);
    expect(gaps.length).toBe(0);
  });

  it("detects gaps larger than threshold", () => {
    const bars: PriceBar[] = [
      { date: "2025-01-01", close: 100 },
      { date: "2025-01-02", close: 101 },
      { date: "2025-01-10", close: 102 },
    ];
    const gaps = detectGaps(bars, 3, true);
    expect(gaps.length).toBe(1);
    expect(gaps[0].missingDays).toBe(7);
  });

  it("ignores small gaps below threshold", () => {
    const bars: PriceBar[] = [
      { date: "2025-01-01", close: 100 },
      { date: "2025-01-03", close: 101 },
    ];
    const gaps = detectGaps(bars, 2, true);
    expect(gaps.length).toBe(0);
  });

  it("handles empty bars", () => {
    const gaps = detectGaps([], 0, true);
    expect(gaps).toEqual([]);
  });

  it("handles single bar", () => {
    const bars: PriceBar[] = [{ date: "2025-01-01", close: 100 }];
    const gaps = detectGaps(bars, 0, true);
    expect(gaps).toEqual([]);
  });
});

describe("detectOutliers", () => {
  it("returns empty for consistent returns", () => {
    const bars = buildBars(new Date("2025-01-01"), 30);
    const outliers = detectOutliers(bars, 3.5);
    expect(outliers.length).toBe(0);
  });

  it("detects extreme values", () => {
    const bars: PriceBar[] = [];
    for (let i = 0; i < 30; i++) {
      const date = new Date("2025-01-01");
      date.setUTCDate(date.getUTCDate() + i);
      bars.push({ date: date.toISOString().slice(0, 10), close: 100 + i * 0.1 });
    }
    bars[15].close = 200;
    const outliers = detectOutliers(bars, 3);
    expect(outliers.length).toBeGreaterThan(0);
    expect(outliers.some((o) => o.date === bars[15].date)).toBe(true);
  });

  it("handles insufficient data", () => {
    const bars: PriceBar[] = [
      { date: "2025-01-01", close: 100 },
      { date: "2025-01-02", close: 101 },
    ];
    const outliers = detectOutliers(bars, 3);
    expect(outliers.length).toBe(0);
  });
});

describe("computeCompleteness", () => {
  it("returns 1 for complete data", () => {
    const bars = buildBars(new Date("2025-01-01"), 10);
    const completeness = computeCompleteness(bars, "2025-01-01", "2025-01-10", true);
    expect(completeness).toBeCloseTo(1.0);
  });

  it("returns lower value for gaps", () => {
    const bars: PriceBar[] = [
      { date: "2025-01-01", close: 100 },
      { date: "2025-01-05", close: 105 },
    ];
    const completeness = computeCompleteness(bars, "2025-01-01", "2025-01-05", true);
    expect(completeness).toBeLessThan(1.0);
    expect(completeness).toBeGreaterThan(0);
  });

  it("handles empty range", () => {
    const completeness = computeCompleteness([], "2025-01-01", "2025-01-01", true);
    expect(completeness).toBe(0);
  });
});

describe("computeQualityScore", () => {
  it("returns high score for good data", () => {
    const score = computeQualityScore(0.95, [], [], "database", 60);
    expect(score).toBeGreaterThanOrEqual(85);
  });

  it("penalizes synthetic data heavily", () => {
    const syntheticScore = computeQualityScore(1.0, [], [], "synthetic", 60);
    const realScore = computeQualityScore(1.0, [], [], "database", 60);
    expect(syntheticScore).toBeLessThan(realScore);
    expect(realScore - syntheticScore).toBeGreaterThanOrEqual(40);
  });

  it("penalizes gaps", () => {
    const gapScore = computeQualityScore(
      0.9,
      [{ startDate: "2025-01-10", endDate: "2025-01-15", missingDays: 6 }],
      [],
      "database",
      60,
    );
    const noGapScore = computeQualityScore(0.9, [], [], "database", 60);
    expect(gapScore).toBeLessThan(noGapScore);
  });

  it("penalizes outliers", () => {
    const outlierScore = computeQualityScore(
      1.0,
      [],
      [{ date: "2025-01-15", value: 200, zScore: 4, direction: "high" }],
      "database",
      60,
    );
    const noOutlierScore = computeQualityScore(1.0, [], [], "database", 60);
    expect(outlierScore).toBeLessThan(noOutlierScore);
  });

  it("penalizes low bar count", () => {
    const lowBarScore = computeQualityScore(1.0, [], [], "database", 10);
    const highBarScore = computeQualityScore(1.0, [], [], "database", 60);
    expect(lowBarScore).toBeLessThan(highBarScore);
  });
});

describe("validateDataQuality", () => {
  it("returns comprehensive report", () => {
    const historyResult: PriceHistoryResult = {
      bars: buildBars(new Date("2025-01-01"), 40),
      dataSource: "database",
    };

    const report = validateDataQuality(
      historyResult,
      "asset-123",
      new Date("2025-01-01"),
      new Date("2025-02-10"),
      true,
    );

    expect(report.assetId).toBe("asset-123");
    expect(report.dataSource).toBe("database");
    expect(report.qualityScore).toBeGreaterThanOrEqual(0);
    expect(report.qualityScore).toBeLessThanOrEqual(100);
    expect(report.isSufficientForEvaluation).toBe(true);
  });

  it("marks synthetic data as insufficient", () => {
    const historyResult: PriceHistoryResult = {
      bars: buildBars(new Date("2025-01-01"), 40),
      dataSource: "synthetic",
      warning: "Dati sintetici",
    };

    const report = validateDataQuality(
      historyResult,
      "asset-123",
      new Date("2025-01-01"),
      new Date("2025-02-10"),
      true,
    );

    expect(report.isSufficientForEvaluation).toBe(false);
    expect(report.warnings.length).toBeGreaterThan(0);
    expect(report.warnings.some((w) => w.includes("sintetici"))).toBe(true);
  });

  it("marks low bar count as insufficient", () => {
    const historyResult: PriceHistoryResult = {
      bars: buildBars(new Date("2025-01-01"), 10),
      dataSource: "database",
    };

    const report = validateDataQuality(
      historyResult,
      "asset-123",
      new Date("2025-01-01"),
      new Date("2025-01-10"),
      true,
    );

    expect(report.isSufficientForEvaluation).toBe(false);
    expect(report.warnings.some((w) => w.includes("barre"))).toBe(true);
  });
});
