import { describe, expect, it } from "vitest";
import { computeRealizedPnl } from "./realizedPnl";

describe("computeRealizedPnl", () => {
  it("sums realized PnL from FILLED SELL logs", () => {
    const summary = computeRealizedPnl([
      {
        side: "SELL",
        status: "FILLED",
        quantity: 2,
        fillPrice: 110,
        costBasisPerUnit: 100,
        realizedPnl: 20,
        assetId: "a1",
        symbol: "BTC",
      },
      {
        side: "BUY",
        status: "FILLED",
        quantity: 2,
        fillPrice: 100,
        costBasisPerUnit: null,
        realizedPnl: null,
        assetId: "a1",
        symbol: "BTC",
      },
    ]);
    expect(summary.total).toBe(20);
    expect(summary.byAsset.a1.total).toBe(20);
  });

  it("derives PnL from cost basis when realizedPnl missing", () => {
    const summary = computeRealizedPnl([
      {
        side: "SELL",
        status: "FILLED",
        quantity: 1,
        fillPrice: 50,
        costBasisPerUnit: 40,
        realizedPnl: null,
        assetId: "a2",
        symbol: "ETH",
      },
    ]);
    expect(summary.total).toBe(10);
  });
});
