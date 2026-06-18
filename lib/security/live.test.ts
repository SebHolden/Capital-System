import { describe, expect, it, afterEach } from "vitest";
import type { UserSettings } from "@prisma/client";
import { checkLiveOrderLimits, verifyLivePassphrase } from "./live";

function mockSettings(
  overrides: Partial<UserSettings> = {},
): UserSettings {
  return {
    id: "default",
    hypotheticalCapital: 10000,
    cashBalance: 5500,
    executionMode: "MOCK",
    killSwitchActive: false,
    maxPositionPct: 25,
    maxBucketPct: 40,
    maxDailyOrders: 5,
    maxOrderAmount: 1000,
    maxLiveOrderAmount: 500,
    maxDailyLiveAmount: 2000,
    maxMonthlyLiveAmount: 10000,
    minCashReserve: 1000,
    maxCryptoPct: 15,
    maxDailyLossPct: 3,
    maxMonthlyLossPct: 8,
    maxExperimentalPct: 10,
    maxDrawdownPct: 15,
    tradingWindowEnabled: false,
    tradingStartHour: 9,
    tradingEndHour: 18,
    tradingTimezone: "Europe/Rome",
    peakPortfolioValue: 10000,
    dailyBaselineValue: 10000,
    monthlyBaselineValue: 10000,
    dailyBaselineDate: new Date(),
    monthlyBaselineKey: "2026-06",
    maxSingleCryptoPct: 5,
    leverageAllowed: false,
    maxAssetPumpPct: 15,
    assetPumpLookbackDays: 7,
    maxAssetVolatilityPct: 80,
    revengeTradingLossPct: 1,
    experimentalCapital: 0,
    experimentalCashBalance: 0,
    updatedAt: new Date(),
    ...overrides,
  };
}

describe("checkLiveOrderLimits", () => {
  it("allows order within all limits", () => {
    const result = checkLiveOrderLimits(mockSettings(), 200, 500, 3000);
    expect(result.allowed).toBe(true);
  });

  it("blocks order above per-order max", () => {
    const result = checkLiveOrderLimits(mockSettings(), 600, 0, 0);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("massimo");
  });

  it("blocks when daily volume would exceed limit", () => {
    const result = checkLiveOrderLimits(mockSettings(), 300, 1800, 0);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("giornaliero");
  });

  it("blocks when monthly volume would exceed limit", () => {
    const result = checkLiveOrderLimits(mockSettings(), 500, 0, 9800);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("mensile");
  });
});

describe("verifyLivePassphrase", () => {
  const original = process.env.LIVE_TRADING_PASSPHRASE;

  it("returns false when passphrase not configured", () => {
    delete process.env.LIVE_TRADING_PASSPHRASE;
    expect(verifyLivePassphrase("anything")).toBe(false);
  });

  it("returns true only for exact match", () => {
    process.env.LIVE_TRADING_PASSPHRASE = "secret-pass";
    expect(verifyLivePassphrase("secret-pass")).toBe(true);
    expect(verifyLivePassphrase("wrong")).toBe(false);
  });

  afterEach(() => {
    if (original === undefined) {
      delete process.env.LIVE_TRADING_PASSPHRASE;
    } else {
      process.env.LIVE_TRADING_PASSPHRASE = original;
    }
  });
});
