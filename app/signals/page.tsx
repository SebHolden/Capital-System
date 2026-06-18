import { AppShell } from "@/components/layout/AppShell";
import { SignalsClient } from "@/components/signals/SignalsClient";
import { listPaperSignals } from "@/lib/paper-signals";

export default async function SignalsPage() {
  const signals = await listPaperSignals({ limit: 100 });

  return (
    <AppShell>
      <SignalsClient
        initialSignals={signals.map((s) => ({
          id: s.id,
          signalDate: s.signalDate.toISOString(),
          signalType: s.signalType,
          plannedEntry: s.plannedEntry,
          currentResultPct: s.currentResultPct,
          result1dPct: s.result1dPct,
          result7dPct: s.result7dPct,
          result30dPct: s.result30dPct,
          maePct: s.maePct,
          mfePct: s.mfePct,
          ruleFollowed: s.ruleFollowed,
          status: s.status,
          closeReason: s.closeReason,
          reason: s.reason,
          strategy: { id: s.strategy.id, name: s.strategy.name },
          asset: { symbol: s.asset.symbol },
        }))}
      />
    </AppShell>
  );
}
