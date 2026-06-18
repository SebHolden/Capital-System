import { describe, expect, it } from "vitest";
import { cumulativeReturn, dailyReturns } from "./returns";

describe("dailyReturns", () => {
  it("computes simple daily returns", () => {
    const returns = dailyReturns([
      { date: "2026-01-01", close: 100 },
      { date: "2026-01-02", close: 110 },
      { date: "2026-01-03", close: 99 },
    ]);
    expect(returns[0]).toBeCloseTo(0.1);
    expect(returns[1]).toBeCloseTo(-0.1);
  });

  it("computes cumulative return", () => {
    const pct = cumulativeReturn([
      { date: "2026-01-01", close: 100 },
      { date: "2026-01-02", close: 120 },
    ]);
    expect(pct).toBe(20);
  });
});
