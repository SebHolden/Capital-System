import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  disconnectPaperFixtures,
  getPaperTestPrisma,
  seedPaperFixtures,
  setupPaperTestDatabase,
} from "@/lib/test/paperFixtures";

vi.mock("@/lib/db", () => ({
  get prisma() {
    return getPaperTestPrisma();
  },
}));

import { refreshPaperSignalMetrics } from "./monitor";
import { closeOppositeOpenSignals } from "./lifecycle";

vi.mock("@/lib/prices/history", () => ({
  fetchPriceHistory: vi.fn(),
}));

vi.mock("@/lib/prices", () => ({
  resolvePrice: vi.fn(),
  effectivePrice: vi.fn(),
}));

import { fetchPriceHistory } from "@/lib/prices/history";
import { effectivePrice, resolvePrice } from "@/lib/prices";

function buildBars(startClose: number, days: number) {
  return Array.from({ length: days }, (_, i) => {
    const day = i + 1;
    const date = `2026-01-${String(day).padStart(2, "0")}`;
    const close = startClose + i;
    return { date, open: close, high: close, low: close, close };
  });
}

describe("refreshPaperSignalMetrics integration", () => {
  beforeAll(() => {
    setupPaperTestDatabase("test-paper.db");
  });

  beforeEach(async () => {
    vi.mocked(fetchPriceHistory).mockReset();
    vi.mocked(resolvePrice).mockReset();
    vi.mocked(effectivePrice).mockReset();
    await seedPaperFixtures();
  });

  afterAll(async () => {
    await disconnectPaperFixtures();
  });

  it("populates 1d/7d/30d metrics and closes at 30d horizon", async () => {
    const prisma = getPaperTestPrisma();
    const strategy = await prisma.strategy.findFirstOrThrow({
      include: { primaryAsset: true },
    });
    const asset = strategy.primaryAsset!;
    const signalDate = new Date("2026-01-01T12:00:00.000Z");
    const bars = buildBars(100, 35);

    const signal = await prisma.paperSignal.create({
      data: {
        strategyId: strategy.id,
        assetId: asset.id,
        signalDate,
        signalType: "BUY",
        plannedEntry: 100,
        reason: "DCA_MONTHLY",
        status: "OPEN",
      },
    });

    vi.mocked(fetchPriceHistory).mockResolvedValue({ bars, warning: undefined });
    vi.mocked(resolvePrice).mockResolvedValue({
      price: 134,
      currency: "EUR",
      status: "live",
      capturedAt: new Date(),
      source: "test",
    });
    vi.mocked(effectivePrice).mockReturnValue(134);

    const now = new Date("2026-02-05T12:00:00.000Z");
    vi.setSystemTime(now);

    const { updated } = await refreshPaperSignalMetrics();
    expect(updated).toBe(1);

    const refreshed = await prisma.paperSignal.findUniqueOrThrow({
      where: { id: signal.id },
    });

    expect(refreshed.result1dPct).toBeCloseTo(1);
    expect(refreshed.result7dPct).toBeCloseTo(7);
    expect(refreshed.result30dPct).toBeCloseTo(30);
    expect(refreshed.maePct).not.toBeNull();
    expect(refreshed.mfePct).not.toBeNull();
    expect(refreshed.status).toBe("CLOSED");
    expect(refreshed.closeReason).toBe("HORIZON_30D");
    expect(refreshed.outcome).toBe("WIN");

    vi.useRealTimers();
  });

  it("expires signal after 90 days without 30d bar", async () => {
    const prisma = getPaperTestPrisma();
    const strategy = await prisma.strategy.findFirstOrThrow();
    const asset = await prisma.asset.findFirstOrThrow();
    const signalDate = new Date("2026-01-01T12:00:00.000Z");

    const signal = await prisma.paperSignal.create({
      data: {
        strategyId: strategy.id,
        assetId: asset.id,
        signalDate,
        signalType: "BUY",
        plannedEntry: 100,
        reason: "DCA_MONTHLY",
        status: "OPEN",
      },
    });

    vi.mocked(fetchPriceHistory).mockResolvedValue({
      bars: buildBars(100, 5),
      warning: undefined,
    });
    vi.mocked(resolvePrice).mockResolvedValue({
      price: 104,
      currency: "EUR",
      status: "live",
      capturedAt: new Date(),
      source: "test",
    });
    vi.mocked(effectivePrice).mockReturnValue(104);

    const now = new Date("2026-04-15T12:00:00.000Z");
    vi.setSystemTime(now);

    await refreshPaperSignalMetrics();

    const refreshed = await prisma.paperSignal.findUniqueOrThrow({
      where: { id: signal.id },
    });

    expect(refreshed.status).toBe("EXPIRED");
    expect(refreshed.closeReason).toBe("EXPIRED");
    expect(refreshed.outcome).toBe("EXPIRED");

    vi.useRealTimers();
  });

  it("closes opposite open signal", async () => {
    const prisma = getPaperTestPrisma();
    const strategy = await prisma.strategy.findFirstOrThrow();
    const asset = await prisma.asset.findFirstOrThrow();

    const openSell = await prisma.paperSignal.create({
      data: {
        strategyId: strategy.id,
        assetId: asset.id,
        signalDate: new Date("2026-01-01T12:00:00.000Z"),
        signalType: "SELL",
        plannedEntry: 100,
        reason: "MA_CROSS_SELL_10_30",
        status: "OPEN",
      },
    });

    const closed = await closeOppositeOpenSignals({
      strategyId: strategy.id,
      assetId: asset.id,
      newSignalType: "BUY",
      now: new Date("2026-01-10T12:00:00.000Z"),
    });

    expect(closed).toBe(1);

    const refreshed = await prisma.paperSignal.findUniqueOrThrow({
      where: { id: openSell.id },
    });

    expect(refreshed.status).toBe("CLOSED");
    expect(refreshed.closeReason).toBe("OPPOSITE_SIGNAL");
  });
});
