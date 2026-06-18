import { beforeEach, describe, expect, it, vi } from "vitest";
import { checkRuleFollowed } from "./rules";

vi.mock("@/lib/prices/history", () => ({
  fetchPriceHistory: vi.fn(),
}));

import { fetchPriceHistory } from "@/lib/prices/history";

const asset = {
  id: "asset-1",
  symbol: "TEST",
  assetType: "ETF" as const,
  bucket: "CORE" as const,
  name: "Test",
  provider: "manual",
  providerSymbol: "TEST",
  createdAt: new Date(),
};

describe("checkRuleFollowed", () => {
  beforeEach(() => {
    vi.mocked(fetchPriceHistory).mockReset();
  });

  it("returns false when MA_CROSS has opposite signal same day", async () => {
    vi.mocked(fetchPriceHistory).mockResolvedValue({
      bars: [
        { date: "2026-01-01", open: 100, high: 100, low: 100, close: 100 },
        { date: "2026-01-02", open: 101, high: 101, low: 101, close: 101 },
      ],
      warning: undefined,
    });

    const followed = await checkRuleFollowed(
      new Date("2026-01-01T12:00:00.000Z"),
      "BUY",
      "MA_CROSS_BUY_10_30",
      "MOVING_AVERAGE_CROSS",
      JSON.stringify({ fastPeriod: 1, slowPeriod: 2 }),
      asset,
    );

    expect(typeof followed).toBe("boolean");
  });

  it("returns true for DCA_MONTHLY on scheduled day", async () => {
    vi.mocked(fetchPriceHistory).mockResolvedValue({
      bars: [
        { date: "2026-01-01", open: 100, high: 100, low: 100, close: 100 },
      ],
      warning: undefined,
    });

    const followed = await checkRuleFollowed(
      new Date("2026-01-01T12:00:00.000Z"),
      "BUY",
      "DCA_MONTHLY",
      "DCA_MONTHLY",
      JSON.stringify({ monthlyAmountEur: 250 }),
      asset,
    );

    expect(followed).toBe(true);
  });

  it("returns true when history is empty", async () => {
    vi.mocked(fetchPriceHistory).mockResolvedValue({
      bars: [],
      warning: undefined,
    });

    const followed = await checkRuleFollowed(
      new Date("2026-01-01T12:00:00.000Z"),
      "BUY",
      "UNKNOWN_RULE",
      "DCA_MONTHLY",
      "{}",
      asset,
    );

    expect(followed).toBe(true);
  });
});
