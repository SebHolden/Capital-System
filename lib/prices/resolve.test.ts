import { describe, expect, it } from "vitest";
import type { ResolvedPrice } from "./types";
import {
  effectivePrice,
  isDisplayablePrice,
  isMarketPriceUsable,
  isTrustedMarketPrice,
} from "./resolve";

function resolved(overrides: Partial<ResolvedPrice>): ResolvedPrice {
  return {
    assetId: "a1",
    symbol: "BTC",
    price: 100,
    currency: "EUR",
    status: "fresh",
    source: "coingecko",
    capturedAt: new Date(),
    fallbackAvgPrice: 90,
    ...overrides,
  };
}

describe("isTrustedMarketPrice", () => {
  it("returns true only for fresh prices", () => {
    expect(isTrustedMarketPrice(resolved({ status: "fresh" }))).toBe(true);
  });

  it("treats manual, stale, and missing as untrusted", () => {
    expect(isTrustedMarketPrice(resolved({ status: "manual" }))).toBe(false);
    expect(isTrustedMarketPrice(resolved({ status: "stale" }))).toBe(false);
    expect(isTrustedMarketPrice(resolved({ status: "missing", price: 0 }))).toBe(
      false,
    );
  });

  it("rejects zero or negative prices", () => {
    expect(isTrustedMarketPrice(resolved({ status: "fresh", price: 0 }))).toBe(
      false,
    );
  });
});

describe("isDisplayablePrice", () => {
  it("allows fresh, stale, and manual for display", () => {
    expect(isDisplayablePrice(resolved({ status: "fresh" }))).toBe(true);
    expect(isDisplayablePrice(resolved({ status: "stale" }))).toBe(true);
    expect(isDisplayablePrice(resolved({ status: "manual" }))).toBe(true);
  });

  it("rejects missing prices", () => {
    expect(isDisplayablePrice(resolved({ status: "missing", price: 0 }))).toBe(
      false,
    );
  });
});

describe("isMarketPriceUsable", () => {
  it("matches displayable price semantics", () => {
    expect(isMarketPriceUsable(resolved({ status: "manual" }))).toBe(true);
    expect(isMarketPriceUsable(resolved({ status: "missing", price: 0 }))).toBe(
      false,
    );
  });
});

describe("effectivePrice", () => {
  it("uses resolved price when displayable", () => {
    expect(effectivePrice(resolved({ status: "stale", price: 105 }))).toBe(105);
  });

  it("falls back to avgPrice when missing", () => {
    expect(
      effectivePrice(
        resolved({ status: "missing", price: 0, fallbackAvgPrice: 88 }),
      ),
    ).toBe(88);
  });
});
