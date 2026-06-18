import { AppShell } from "@/components/layout/AppShell";
import { StrategiesClient } from "@/components/strategies/StrategiesClient";
import { listPaperSignals, listStrategiesWithBacktests } from "@/lib/paper-signals";

export default async function StrategiesPage() {
  const [strategies, signals] = await Promise.all([
    listStrategiesWithBacktests(),
    listPaperSignals({ limit: 50 }),
  ]);

  return (
    <AppShell>
      <StrategiesClient
        initialStrategies={strategies.map((s) => ({
          ...s,
          promotedAt: s.promotedAt?.toISOString() ?? null,
          latestBacktest: s.latestBacktest
            ? {
                metrics: s.latestBacktest.metrics
                  ? {
                      totalReturnPct: s.latestBacktest.metrics.totalReturnPct,
                      maxDrawdownPct: s.latestBacktest.metrics.maxDrawdownPct,
                    }
                  : null,
              }
            : null,
        }))}
        initialSignals={signals.map((signal) => ({
          id: signal.id,
          signalDate: signal.signalDate.toISOString(),
          signalType: signal.signalType,
          plannedEntry: signal.plannedEntry,
          currentResultPct: signal.currentResultPct,
          result7dPct: signal.result7dPct,
          result30dPct: signal.result30dPct,
          maePct: signal.maePct,
          mfePct: signal.mfePct,
          ruleFollowed: signal.ruleFollowed,
          status: signal.status,
          strategy: { name: signal.strategy.name },
          asset: { symbol: signal.asset.symbol },
        }))}
      />
    </AppShell>
  );
}
