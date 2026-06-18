import { AppShell } from "@/components/layout/AppShell";
import { BacktestsClient } from "@/components/backtests/BacktestsClient";
import { listBacktestRuns } from "@/lib/backtesting";
import { getAllAssets } from "@/lib/portfolio";

export default async function BacktestsPage() {
  const [assets, runs] = await Promise.all([
    getAllAssets(),
    listBacktestRuns(20),
  ]);

  return (
    <AppShell>
      <BacktestsClient
        assets={assets}
        initialRuns={runs.map((run) => ({
          ...run,
          startDate: run.startDate.toISOString(),
          endDate: run.endDate.toISOString(),
          createdAt: run.createdAt.toISOString(),
        }))}
      />
    </AppShell>
  );
}
