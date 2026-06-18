import { prisma } from "@/lib/db";
import { fetchPriceHistory } from "@/lib/prices/history";
import { effectivePrice, resolvePrice } from "@/lib/prices";
import { writeAuditLog } from "@/lib/security";
import {
  getDefaultStrategyConfig,
  getStrategyDefinition,
} from "@/lib/strategies";
import { addDays, mapSignalType, toDateKey } from "./utils";

const LOOKBACK_DAYS = 120;

export async function generatePaperSignals(): Promise<{
  created: number;
  skipped: number;
}> {
  const strategies = await prisma.strategy.findMany({
    where: { status: "PAPER_ACTIVE" },
  });

  let created = 0;
  let skipped = 0;
  const todayKey = toDateKey(new Date());

  for (const strategy of strategies) {
    const assetId = strategy.primaryAssetId;
    if (!assetId) {
      skipped += 1;
      continue;
    }

    const asset = await prisma.asset.findUnique({ where: { id: assetId } });
    if (!asset) {
      skipped += 1;
      continue;
    }

    const endDate = new Date();
    const startDate = addDays(endDate, -LOOKBACK_DAYS);
    const history = await fetchPriceHistory(asset, startDate, endDate);
    if (history.bars.length === 0) {
      skipped += 1;
      continue;
    }

    const latestBarDate =
      history.bars[history.bars.length - 1]?.date ?? todayKey;
    const targetDate = history.bars.some((b) => b.date === todayKey)
      ? todayKey
      : latestBarDate;

    const config = {
      ...getDefaultStrategyConfig(strategy.type),
      ...JSON.parse(strategy.configJson),
    };

    const strategyDef = getStrategyDefinition(strategy.type);
    const signals = strategyDef.generateSignals(
      {
        bars: history.bars,
        assetId: asset.id,
        assetSymbol: asset.symbol,
        initialCapital: 10_000,
      },
      config,
    );

    const daySignals = signals.filter((signal) => signal.date === targetDate);
    if (daySignals.length === 0) {
      skipped += 1;
      continue;
    }

    const resolved = await resolvePrice(asset);
    const marketPrice = effectivePrice(resolved);
    const barPrice =
      history.bars.find((b) => b.date === targetDate)?.close ?? 0;
    const plannedEntry = marketPrice > 0 ? marketPrice : barPrice;

    for (const signal of daySignals) {
      const signalType = mapSignalType(signal.side);
      const signalDate = new Date(`${signal.date}T12:00:00.000Z`);

      try {
        await prisma.paperSignal.create({
          data: {
            strategyId: strategy.id,
            assetId: asset.id,
            signalDate,
            signalType,
            plannedEntry,
            amountEur: signal.amountEur,
            reason: signal.reason,
            status: "OPEN",
          },
        });
        created += 1;

        await writeAuditLog("PAPER_SIGNAL_GENERATED", "PaperSignal", {
          strategyId: strategy.id,
          assetId: asset.id,
          signalType,
          reason: signal.reason,
          signalDate: signal.date,
        });
      } catch {
        skipped += 1;
      }
    }
  }

  return { created, skipped };
}
