import type { PaperSignalType, StrategyType } from "@prisma/client";
import { fetchPriceHistory } from "@/lib/prices/history";
import {
  getDefaultStrategyConfig,
  getStrategyDefinition,
} from "@/lib/strategies";
import type { StrategySignal } from "@/lib/strategies";
import { addDays, toDateKey } from "./utils";

type AssetForHistory = {
  id: string;
  symbol: string;
  assetType: import("@prisma/client").AssetType;
  bucket: import("@prisma/client").Bucket;
  name: string;
  provider: string | null;
  providerSymbol: string | null;
  createdAt: Date;
};

function hasOppositeOnDay(
  signals: StrategySignal[],
  signalDay: string,
  signalSide: PaperSignalType,
  reasonPrefix: string,
): boolean {
  const opposite = signalSide === "BUY" ? "SELL" : "BUY";
  return signals.some(
    (s) =>
      s.date === signalDay &&
      s.side === opposite &&
      s.reason.includes(reasonPrefix),
  );
}

function isScheduledReason(reason: string): boolean {
  return (
    reason.startsWith("DCA_MONTHLY") ||
    reason.startsWith("REBALANCE_MONTHLY") ||
    reason.startsWith("CORE_SATELLITE")
  );
}

export async function checkRuleFollowed(
  signalDate: Date,
  signalType: PaperSignalType,
  reason: string,
  strategyType: StrategyType,
  configJson: string,
  asset: AssetForHistory,
): Promise<boolean> {
  const signalDay = toDateKey(signalDate);
  const endDate = addDays(signalDate, 3);
  const history = await fetchPriceHistory(asset, signalDate, endDate);
  if (history.bars.length < 1) return true;

  const config = {
    ...getDefaultStrategyConfig(strategyType),
    ...JSON.parse(configJson),
  };
  const strategyDef = getStrategyDefinition(strategyType);
  const signals = strategyDef.generateSignals(
    {
      bars: history.bars,
      assetId: asset.id,
      assetSymbol: asset.symbol,
      initialCapital: 10_000,
    },
    config,
  );

  if (reason.includes("MA_CROSS")) {
    return !hasOppositeOnDay(signals, signalDay, signalType, "MA_CROSS");
  }

  if (
    reason.startsWith("MOMENTUM") ||
    reason.startsWith("VOL_FILTER") ||
    reason.startsWith("BUY_THE_DIP")
  ) {
    const prefix = reason.split(" ")[0] ?? reason;
    return !hasOppositeOnDay(signals, signalDay, signalType, prefix);
  }

  if (isScheduledReason(reason)) {
    const prefix = reason.split(" ")[0] ?? reason;
    const expected = signals.find(
      (s) => s.date === signalDay && s.reason.startsWith(prefix),
    );
    return expected !== undefined;
  }

  return true;
}
