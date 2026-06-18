import { describe, expect, it } from "vitest";
import {
  addDays,
  computeMaeMfe,
  findBarOnOrAfter,
  resultPctForSide,
  toDateKey,
} from "./utils";

describe("paper-signals utils", () => {
  it("computes BUY result pct", () => {
    expect(resultPctForSide("BUY", 100, 110)).toBeCloseTo(10);
  });

  it("computes SELL result pct", () => {
    expect(resultPctForSide("SELL", 100, 90)).toBeCloseTo(10);
  });

  it("returns null for invalid prices", () => {
    expect(resultPctForSide("BUY", 0, 100)).toBeNull();
  });

  it("finds bar on or after target date", () => {
    const bars = [
      { date: "2026-01-01", close: 100, open: 100, high: 100, low: 100 },
      { date: "2026-01-08", close: 105, open: 105, high: 105, low: 105 },
    ];
    const target = new Date("2026-01-07T12:00:00.000Z");
    const bar = findBarOnOrAfter(bars, target);
    expect(bar?.date).toBe("2026-01-08");
  });

  it("computes MAE and MFE over bars", () => {
    const bars = [
      { date: "2026-01-01", close: 100, open: 100, high: 100, low: 100 },
      { date: "2026-01-02", close: 90, open: 90, high: 90, low: 90 },
      { date: "2026-01-03", close: 115, open: 115, high: 115, low: 115 },
    ];
    const { maePct, mfePct } = computeMaeMfe("BUY", 100, bars);
    expect(maePct).toBeCloseTo(-10);
    expect(mfePct).toBeCloseTo(15);
  });

  it("formats date keys in UTC", () => {
    const key = toDateKey(new Date("2026-06-15T12:00:00.000Z"));
    expect(key).toBe("2026-06-15");
  });

  it("adds days in UTC", () => {
    const base = new Date("2026-01-01T12:00:00.000Z");
    const result = addDays(base, 7);
    expect(toDateKey(result)).toBe("2026-01-08");
  });
});
