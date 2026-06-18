import { prisma } from "@/lib/db";
import { fetchPriceHistory } from "@/lib/prices/history";
import { effectivePrice, resolvePrice } from "@/lib/prices";
import { computeSignalMetrics } from "./metrics";
import { resolveSignalStatus } from "./lifecycle";
import { checkRuleFollowed } from "./rules";

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
    const metrics = computeSignalMetrics({
      signalType: signal.signalType,
      plannedEntry: signal.plannedEntry,
      signalDate: signal.signalDate,
      bars: history.bars,
      currentPrice,
    });

    const ruleFollowed = await checkRuleFollowed(
      signal.signalDate,
      signal.signalType,
      signal.reason,
      signal.strategy.type,
      signal.strategy.configJson,
      signal.asset,
    );

    const oppositeSignals = await prisma.paperSignal.findMany({
      where: {
        strategyId: signal.strategyId,
        assetId: signal.assetId,
        status: { in: ["OPEN", "CLOSED"] },
        signalDate: { gt: signal.signalDate },
        id: { not: signal.id },
      },
    });

    const hasOppositeSignal = oppositeSignals.some(
      (other) =>
        (other.signalType === "BUY" && signal.signalType === "SELL") ||
        (other.signalType === "SELL" && signal.signalType === "BUY"),
    );

    const lifecycle = resolveSignalStatus({
      currentStatus: signal.status,
      signalDate: signal.signalDate,
      result30dPct: metrics.result30dPct,
      now,
      hasOppositeSignal,
    });

    await prisma.paperSignal.update({
      where: { id: signal.id },
      data: {
        ...metrics,
        ruleFollowed,
        lastMonitoredAt: now,
        status: lifecycle.status,
        closedAt: lifecycle.closedAt ?? signal.closedAt,
        closeReason: lifecycle.closeReason ?? signal.closeReason,
      },
    });

    updated += 1;
  }

  return { updated };
}
