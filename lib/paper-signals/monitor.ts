import { prisma } from "@/lib/db";
import { fetchPriceHistory } from "@/lib/prices/history";
import { effectivePrice, resolvePrice } from "@/lib/prices";
import { toDateKey } from "./utils";
import { computeSignalMetrics } from "./metrics";
import { resolveSignalStatus } from "./lifecycle";
import { checkRuleFollowed } from "./rules";
import { classifyOutcome, isEvaluatedOutcome } from "./outcome";

async function refreshSingleSignal(
  signal: Awaited<ReturnType<typeof loadSignalsForRefresh>>[number],
  now: Date,
): Promise<void> {
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

  const monitorBars = history.bars.filter(
    (bar) => bar.date >= toDateKey(signal.signalDate),
  );

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

  const lifecycle =
    signal.status === "OPEN"
      ? resolveSignalStatus({
          currentStatus: signal.status,
          signalDate: signal.signalDate,
          result30dPct: metrics.result30dPct,
          now,
          hasOppositeSignal,
        })
      : {
          status: signal.status,
          closeReason: signal.closeReason,
          closedAt: signal.closedAt,
        };

  const outcome = classifyOutcome({
    signalType: signal.signalType,
    result30dPct: metrics.result30dPct,
    result7dPct: metrics.result7dPct,
    status: lifecycle.status,
    barsAfterSignal: monitorBars.length,
  });

  const evaluatedAt = isEvaluatedOutcome(outcome) ? now : signal.evaluatedAt;

  await prisma.paperSignal.update({
    where: { id: signal.id },
    data: {
      ...metrics,
      ruleFollowed,
      outcome,
      evaluatedAt,
      lastMonitoredAt: now,
      status: lifecycle.status,
      closedAt: lifecycle.closedAt ?? signal.closedAt,
      closeReason: lifecycle.closeReason ?? signal.closeReason,
    },
  });
}

async function loadSignalsForRefresh() {
  return prisma.paperSignal.findMany({
    where: {
      OR: [
        { status: "OPEN" },
        {
          status: { in: ["CLOSED", "EXPIRED"] },
          outcome: "PENDING",
        },
      ],
    },
    include: { asset: true, strategy: true },
  });
}

export async function refreshPaperSignalMetrics(): Promise<{
  updated: number;
}> {
  const signals = await loadSignalsForRefresh();
  const now = new Date();

  for (const signal of signals) {
    await refreshSingleSignal(signal, now);
  }

  return { updated: signals.length };
}
