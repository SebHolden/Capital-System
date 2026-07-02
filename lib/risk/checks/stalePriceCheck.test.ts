import { describe, expect, it } from "vitest";
import { evaluateStalePriceCheck } from "./stalePriceCheck";
import { UNTRUSTED_ASSET_PRICE_REASON } from "./priceTrustCheck";

describe("evaluateStalePriceCheck", () => {
  it("blocks BUY on stale price", () => {
    const result = evaluateStalePriceCheck({
      side: "BUY",
      priceStatus: "stale",
      symbol: "BTC",
    });
    expect(result.block).toBe(true);
    expect(result.reasons[0]).toBe(UNTRUSTED_ASSET_PRICE_REASON);
  });

  it("blocks BUY on missing price", () => {
    const result = evaluateStalePriceCheck({
      side: "BUY",
      priceStatus: "missing",
      symbol: "XYZ",
    });
    expect(result.block).toBe(true);
    expect(result.reasons[0]).toBe(UNTRUSTED_ASSET_PRICE_REASON);
  });

  it("blocks BUY on manual price", () => {
    const result = evaluateStalePriceCheck({
      side: "BUY",
      priceStatus: "manual",
      symbol: "SWDA",
    });
    expect(result.block).toBe(true);
    expect(result.reasons[0]).toBe(UNTRUSTED_ASSET_PRICE_REASON);
  });

  it("allows SELL on stale price with warning", () => {
    const result = evaluateStalePriceCheck({
      side: "SELL",
      priceStatus: "stale",
      symbol: "BTC",
    });
    expect(result.block).toBe(false);
    expect(result.warnings).toContain(UNTRUSTED_ASSET_PRICE_REASON);
  });

  it("blocks automatic orders on non-fresh prices", () => {
    const result = evaluateStalePriceCheck({
      side: "SELL",
      priceStatus: "stale",
      symbol: "BTC",
      automatic: true,
    });
    expect(result.block).toBe(true);
  });
});
