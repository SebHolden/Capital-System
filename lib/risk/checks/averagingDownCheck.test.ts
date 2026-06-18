import { describe, expect, it } from "vitest";
import { evaluateAveragingDownCheck } from "./averagingDownCheck";

describe("evaluateAveragingDownCheck", () => {
  it("blocks BUY below average when enabled", () => {
    const result = evaluateAveragingDownCheck({
      side: "BUY",
      rejectAveragingDown: true,
      limitPrice: 90,
      positionAvgPrice: 100,
      hasPosition: true,
    });
    expect(result.block).toBe(true);
    expect(result.reasons[0]).toContain("Averaging down");
  });

  it("allows BUY at or above average", () => {
    const result = evaluateAveragingDownCheck({
      side: "BUY",
      rejectAveragingDown: true,
      limitPrice: 105,
      positionAvgPrice: 100,
      hasPosition: true,
    });
    expect(result.block).toBe(false);
  });

  it("ignores when setting disabled", () => {
    const result = evaluateAveragingDownCheck({
      side: "BUY",
      rejectAveragingDown: false,
      limitPrice: 50,
      positionAvgPrice: 100,
      hasPosition: true,
    });
    expect(result.block).toBe(false);
  });
});
