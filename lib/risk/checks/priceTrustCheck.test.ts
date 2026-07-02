import { describe, expect, it } from "vitest";
import {
  AUTOMATIC_TRADING_BLOCKED_REASON,
  evaluateAssetPriceTrustCheck,
  evaluatePortfolioPriceTrustCheck,
  UNTRUSTED_ASSET_PRICE_REASON,
  UNTRUSTED_EXPOSURE_REASON,
} from "./priceTrustCheck";

describe("evaluateAssetPriceTrustCheck", () => {
  it("allows fresh prices", () => {
    const result = evaluateAssetPriceTrustCheck({
      side: "BUY",
      priceStatus: "fresh",
    });
    expect(result.block).toBe(false);
  });

  it("blocks BUY on stale, manual, and missing", () => {
    for (const status of ["stale", "manual", "missing"] as const) {
      const result = evaluateAssetPriceTrustCheck({
        side: "BUY",
        priceStatus: status,
      });
      expect(result.block).toBe(true);
      expect(result.reasons).toContain(UNTRUSTED_ASSET_PRICE_REASON);
    }
  });

  it("blocks automatic orders on any non-fresh price", () => {
    const result = evaluateAssetPriceTrustCheck({
      side: "SELL",
      priceStatus: "stale",
      automatic: true,
    });
    expect(result.block).toBe(true);
    expect(result.reasons).toContain(AUTOMATIC_TRADING_BLOCKED_REASON);
  });

  it("warns on SELL with untrusted price for manual review", () => {
    const result = evaluateAssetPriceTrustCheck({
      side: "SELL",
      priceStatus: "manual",
    });
    expect(result.block).toBe(false);
    expect(result.warnings).toContain(UNTRUSTED_ASSET_PRICE_REASON);
  });
});

describe("evaluatePortfolioPriceTrustCheck", () => {
  it("blocks LIVE when untrusted exposure is above 0%", () => {
    const result = evaluatePortfolioPriceTrustCheck({
      hasUntrustedPrices: true,
      untrustedPct: 5,
      executionMode: "LIVE",
    });
    expect(result.block).toBe(true);
    expect(result.reasons).toContain(UNTRUSTED_EXPOSURE_REASON);
  });

  it("blocks PAPER when untrusted exposure exists", () => {
    const result = evaluatePortfolioPriceTrustCheck({
      hasUntrustedPrices: true,
      untrustedPct: 2,
      executionMode: "PAPER",
    });
    expect(result.block).toBe(true);
    expect(result.reasons).toContain(UNTRUSTED_EXPOSURE_REASON);
  });

  it("allows MOCK with warning only", () => {
    const result = evaluatePortfolioPriceTrustCheck({
      hasUntrustedPrices: true,
      untrustedPct: 10,
      executionMode: "MOCK",
    });
    expect(result.block).toBe(false);
    expect(result.warnings).toContain(UNTRUSTED_EXPOSURE_REASON);
  });
});
