import type { PaperSignalType, StrategyType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { fetchPriceHistory } from "@/lib/prices/history";
import { effectivePrice, resolvePrice } from "@/lib/prices";
import {
  getDefaultStrategyConfig,
  getStrategyDefinition,
} from "@/lib/strategies";
import {
  addDays,
  computeMaeMfe,
  findBarOnOrAfter,
  resultPctForSide,
  toDateKey,
} from "./utils";

export async function refreshPaperSignalMetrics(): Promise<{
  updated: number;
}> {
  const signals = await prisma.paperSignal.findMany({
    where: { status: "OPEN" },
    include: { asset: true, strategy: true },
  });

  let updated = 0;
  const now = new Date();

  for (const signal of signals) {
    const history = await fetchPriceHistory(
      signal.asset,
      signal.signalDate,
      now,
    );

    const resolved = await resolvePrice(signal.asset);
    const currentPrice = effectivePrice(resolved);
    const currentResultPct = resultPctForSide(
      signal.signalType,
      signal.plannedEntry,
      currentPrice,
    );

    const bar7d = findBarOnOrAfter(history.bars, addDays(signal.signalDate, 7));
    const bar30d = findBarOnOrAfter(
      history.bars,
      addDays(signal.signalDate, 30),
    );

    const result7dPct = bar7d
      ? resultPctForSide(signal.signalType, signal.plannedEntry, bar7d.close)
      : null;
    const result30dPct = bar30d
      ? resultPctForSide(signal.signalType, signal.plannedEntry, bar30d.close)
      : null;

    const monitorBars = history.bars.filter(
      (bar) => bar.date >= toDateKey(signal.signalDate),
    );
    const { maePct, mfePct } = computeMaeMfe(
      signal.signalType,
      signal.plannedEntry,
      monitorBars,
    );

    const ruleFollowed = await checkRuleFollowed(
      signal.signalDate,
      signal.signalType,
      signal.reason,
      signal.strategy.type,
      signal.strategy.configJson,
      signal.asset,
    );

    await prisma.paperSignal.update({
      where: { id: signal.id },
      data: {
        currentResultPct,
        result7dPct,
        result30dPct,
        maePct,
        mfePct,
        ruleFollowed,
        lastMonitoredAt: now,
        status:
          addDays(signal.signalDate, 90) < now ? "EXPIRED" : signal.status,
      },
    });

    updated += 1;
  }

  return { updated };
}

async function checkRuleFollowed(
  signalDate: Date,
  signalType: PaperSignalType,
  reason: string,
  strategyType: StrategyType,
  configJson: string,
  asset: {
    id: string;
    symbol: string;
    assetType: import("@prisma/client").AssetType;
    bucket: import("@prisma/client").Bucket;
    name: string;
    provider: string | null;
    providerSymbol: string | null;
    createdAt: Date;
  },
): Promise<boolean> {
  if (!reason.includes("MA_CROSS")) {
    return true;
  }

  const endDate = addDays(signalDate, 3);
  const history = await fetchPriceHistory(asset, signalDate, endDate);
  if (history.bars.length < 2) return true;

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

  const signalDay = toDateKey(signalDate);
  const opposite =
    signalType === "BUY"
      ? signals.some(
          (s) =>
            s.date === signalDay &&
            s.side === "SELL" &&
            s.reason.includes("MA_CROSS"),
        )
      : signals.some(
          (s) =>
            s.date === signalDay &&
            s.side === "BUY" &&
            s.reason.includes("MA_CROSS"),
        );

  return !opposite;
}
