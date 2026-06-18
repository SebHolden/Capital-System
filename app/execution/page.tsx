import { AppShell } from "@/components/layout/AppShell";
import { ExecutionClient } from "@/components/execution/ExecutionClient";
import { listExecutionLogs } from "@/lib/execution/logs";

export default async function ExecutionPage() {
  const logs = await listExecutionLogs({ limit: 50 });

  return (
    <AppShell>
      <ExecutionClient initialLogs={logs} />
    </AppShell>
  );
}
