import { describe, expect, it } from "vitest";
import { evaluateStalePriceCheck } from "./stalePriceCheck";

describe("evaluateStalePriceCheck", () => {
  it("blocks BUY on stale price", () => {
    const result = evaluateStalePriceCheck({
      side: "BUY",
      priceStatus: "stale",
      symbol: "BTC",
    });
    expect(result.block).toBe(true);
    expect(result.reasons[0]).toContain("stale");
  });

  it("blocks BUY on missing price", () => {
    const result = evaluateStalePriceCheck({
      side: "BUY",
      priceStatus: "missing",
      symbol: "XYZ",
    });
    expect(result.block).toBe(true);
    expect(result.reasons[0]).toContain("mancante");
  });

  it("allows SELL on stale price", () => {
    const result = evaluateStalePriceCheck({
      side: "SELL",
      priceStatus: "stale",
      symbol: "BTC",
    });
    expect(result.block).toBe(false);
  });

  it("warns on manual price for BUY", () => {
    const result = evaluateStalePriceCheck({
      side: "BUY",
      priceStatus: "manual",
      symbol: "SWDA",
    });
    expect(result.block).toBe(false);
    expect(result.warnings.length).toBeGreaterThan(0);
  });
});
