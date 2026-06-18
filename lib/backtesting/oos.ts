import type { PriceBar } from "@/lib/prices/history";
import type { StrategySignal } from "@/lib/strategies";
import type { Asset } from "@prisma/client";
import { runSimulation } from "./runner";
import { computeMetrics } from "./metrics";

export function splitBars(
  bars: PriceBar[],
  trainRatio = 0.7,
): { train: PriceBar[]; test: PriceBar[] } {
  const splitIdx = Math.max(2, Math.floor(bars.length * trainRatio));
  return {
    train: bars.slice(0, splitIdx),
    test: bars.slice(splitIdx),
  };
}

export function runOutOfSampleMetrics(input: {
  primaryAsset: Asset;
  assets: Asset[];
  barsByAssetId: Map<string, PriceBar[]>;
  testBars: PriceBar[];
  signals: StrategySignal[];
  initialCapital: number;
  commissionBps: number;
  slippageBps: number;
}) {
  if (input.testBars.length < 2) return null;

  const testStart = input.testBars[0].date;
  const testSignals = input.signals.filter((s) => s.date >= testStart);
  const testBarsByAsset = new Map(input.barsByAssetId);
  testBarsByAsset.set(input.primaryAsset.id, input.testBars);

  const simulation = runSimulation({
    primaryAsset: input.primaryAsset,
    assets: input.assets,
    barsByAssetId: testBarsByAsset,
    signals: testSignals,
    initialCapital: input.initialCapital,
    commissionBps: input.commissionBps,
    slippageBps: input.slippageBps,
  });

  return computeMetrics(
    simulation.equityCurve,
    input.initialCapital,
    simulation.trades.length,
    simulation.winningTrades,
    simulation.avgHoldingDays,
  );
}
