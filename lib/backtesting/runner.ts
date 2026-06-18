import type { Asset } from "@prisma/client";
import type { PriceBar } from "@/lib/prices/history";
import type { StrategySignal } from "@/lib/strategies";
import {
  applyBuyCosts,
  applySellCosts,
  computeFees,
} from "./costs";
import type {
  EquityPoint,
  PortfolioState,
  SimulatedTrade,
} from "./types";

function getBarPrice(bars: PriceBar[], date: string): number | null {
  const bar = bars.find((b) => b.date === date);
  return bar?.close ?? null;
}

function getLatestPriceOnOrBefore(bars: PriceBar[], date: string): number | null {
  let price: number | null = null;
  for (const bar of bars) {
    if (bar.date <= date) price = bar.close;
    else break;
  }
  return price;
}

function portfolioValue(
  state: PortfolioState,
  barsByAssetId: Map<string, PriceBar[]>,
  date: string,
): number {
  let value = state.cash;
  for (const [assetId, qty] of Object.entries(state.positions)) {
    const bars = barsByAssetId.get(assetId);
    if (!bars) continue;
    const price = getLatestPriceOnOrBefore(bars, date);
    if (price) value += qty * price;
  }
  return value;
}

function executeBuy(
  state: PortfolioState,
  assetId: string,
  date: string,
  amountEur: number,
  price: number,
  commissionBps: number,
  slippageBps: number,
  reason: string,
): SimulatedTrade | null {
  if (amountEur <= 0 || state.cash <= 0 || price <= 0) return null;

  const spend = Math.min(amountEur, state.cash);
  const fillPrice = applyBuyCosts(price, slippageBps);
  const fees = computeFees(spend, commissionBps);
  const netSpend = spend - fees;
  if (netSpend <= 0) return null;

  const quantity = netSpend / fillPrice;
  state.cash -= spend;
  state.positions[assetId] = (state.positions[assetId] ?? 0) + quantity;

  return {
    date,
    side: "BUY",
    quantity,
    price: fillPrice,
    fees,
    reason,
    assetId,
  };
}

function executeSellAll(
  state: PortfolioState,
  assetId: string,
  date: string,
  price: number,
  commissionBps: number,
  slippageBps: number,
  reason: string,
): SimulatedTrade | null {
  const quantity = state.positions[assetId] ?? 0;
  if (quantity <= 0 || price <= 0) return null;

  const fillPrice = applySellCosts(price, slippageBps);
  const notional = quantity * fillPrice;
  const fees = computeFees(notional, commissionBps);
  state.cash += notional - fees;
  state.positions[assetId] = 0;

  return {
    date,
    side: "SELL",
    quantity,
    price: fillPrice,
    fees,
    reason,
    assetId,
  };
}

function executeRebalance(
  state: PortfolioState,
  date: string,
  targetWeights: Record<string, number>,
  barsByAssetId: Map<string, PriceBar[]>,
  commissionBps: number,
  slippageBps: number,
): SimulatedTrade[] {
  const trades: SimulatedTrade[] = [];
  const totalValue = portfolioValue(state, barsByAssetId, date);
  if (totalValue <= 0) return trades;

  for (const [assetId, targetWeight] of Object.entries(targetWeights)) {
    const bars = barsByAssetId.get(assetId);
    if (!bars) continue;
    const price = getLatestPriceOnOrBefore(bars, date);
    if (!price || price <= 0) continue;

    const currentQty = state.positions[assetId] ?? 0;
    const currentValue = currentQty * price;
    const targetValue = totalValue * targetWeight;
    const delta = targetValue - currentValue;

    if (Math.abs(delta) < 1) continue;

    if (delta > 0) {
      const trade = executeBuy(
        state,
        assetId,
        date,
        delta,
        price,
        commissionBps,
        slippageBps,
        "REBALANCE_MONTHLY",
      );
      if (trade) trades.push(trade);
    } else {
      const sellQty = Math.min(currentQty, Math.abs(delta) / price);
      if (sellQty <= 0) continue;
      const fillPrice = applySellCosts(price, slippageBps);
      const notional = sellQty * fillPrice;
      const fees = computeFees(notional, commissionBps);
      state.cash += notional - fees;
      state.positions[assetId] = currentQty - sellQty;
      trades.push({
        date,
        side: "SELL",
        quantity: sellQty,
        price: fillPrice,
        fees,
        reason: "REBALANCE_MONTHLY",
        assetId,
      });
    }
  }

  return trades;
}

export interface RunSimulationInput {
  primaryAsset: Asset;
  assets: Asset[];
  barsByAssetId: Map<string, PriceBar[]>;
  signals: StrategySignal[];
  initialCapital: number;
  commissionBps: number;
  slippageBps: number;
}

export function runSimulation(input: RunSimulationInput): {
  trades: SimulatedTrade[];
  equityCurve: EquityPoint[];
  finalState: PortfolioState;
  winningTrades: number;
  avgHoldingDays: number;
} {
  const state: PortfolioState = {
    cash: input.initialCapital,
    positions: {},
  };

  const trades: SimulatedTrade[] = [];
  const signalsByDate = new Map<string, StrategySignal[]>();
  for (const signal of input.signals) {
    const list = signalsByDate.get(signal.date) ?? [];
    list.push(signal);
    signalsByDate.set(signal.date, list);
  }

  const primaryBars = input.barsByAssetId.get(input.primaryAsset.id) ?? [];
  const equityCurve: EquityPoint[] = [];

  const openEntries: Array<{ assetId: string; date: string }> = [];
  let closedRoundTrips = 0;
  let winningRoundTrips = 0;
  let totalHoldingDays = 0;

  for (const bar of primaryBars) {
    const daySignals = signalsByDate.get(bar.date) ?? [];

    for (const signal of daySignals) {
      if (signal.side === "BUY" && signal.amountEur) {
        const price =
          getBarPrice(
            input.barsByAssetId.get(input.primaryAsset.id) ?? [],
            signal.date,
          ) ?? bar.close;
        const trade = executeBuy(
          state,
          input.primaryAsset.id,
          signal.date,
          signal.amountEur,
          price,
          input.commissionBps,
          input.slippageBps,
          signal.reason,
        );
        if (trade) {
          trades.push(trade);
          openEntries.push({
            assetId: input.primaryAsset.id,
            date: signal.date,
          });
        }
      } else if (signal.side === "SELL") {
        const price =
          getBarPrice(
            input.barsByAssetId.get(input.primaryAsset.id) ?? [],
            signal.date,
          ) ?? bar.close;
        const trade = executeSellAll(
          state,
          input.primaryAsset.id,
          signal.date,
          price,
          input.commissionBps,
          input.slippageBps,
          signal.reason,
        );
        if (trade) {
          trades.push(trade);
          const entry = openEntries.pop();
          if (entry) {
            closedRoundTrips += 1;
            const holdingDays = Math.max(
              1,
              Math.round(
                (new Date(signal.date).getTime() -
                  new Date(entry.date).getTime()) /
                  (24 * 60 * 60 * 1000),
              ),
            );
            totalHoldingDays += holdingDays;
            const pnl =
              trade.quantity * trade.price -
              trade.fees -
              (state.cash - input.initialCapital);
            if (pnl > 0) winningRoundTrips += 1;
          }
        }
      } else if (signal.side === "HOLD" && signal.targetWeights) {
        const rebalanceTrades = executeRebalance(
          state,
          signal.date,
          signal.targetWeights,
          input.barsByAssetId,
          input.commissionBps,
          input.slippageBps,
        );
        trades.push(...rebalanceTrades);
      }
    }

    equityCurve.push({
      date: bar.date,
      value: portfolioValue(state, input.barsByAssetId, bar.date),
    });
  }

  const sellTrades = trades.filter((t) => t.side === "SELL").length;
  const avgHoldingDays =
    closedRoundTrips > 0 ? totalHoldingDays / closedRoundTrips : sellTrades > 0 ? 30 : 0;

  return {
    trades,
    equityCurve,
    finalState: state,
    winningTrades: winningRoundTrips,
    avgHoldingDays,
  };
}
