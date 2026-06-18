"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardTitle } from "@/components/ui/Card";
import { Select } from "@/components/ui/Select";
import type { ExecutionLogRow } from "@/lib/execution/logs";
import { formatCurrency } from "@/lib/utils";

export function ExecutionClient({
  initialLogs,
}: {
  initialLogs: ExecutionLogRow[];
}) {
  const [logs, setLogs] = useState(initialLogs);
  const [mode, setMode] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  async function refresh() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (mode) params.set("mode", mode);
      if (status) params.set("status", status);
      const res = await fetch(`/api/execution/logs?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setLogs(data.logs);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Errore");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">Esecuzione — audit</h2>
        <p className="text-sm text-slate-400">
          Log read-only di ordini MOCK / PAPER / LIVE. Nessuna azione da questa
          pagina.
        </p>
      </div>

      <Card>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1 block text-xs text-slate-400">Mode</label>
            <Select value={mode} onChange={(e) => setMode(e.target.value)}>
              <option value="">Tutti</option>
              <option value="MOCK">MOCK</option>
              <option value="PAPER">PAPER</option>
              <option value="LIVE">LIVE</option>
            </Select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-400">Status</label>
            <Select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">Tutti</option>
              <option value="FILLED">FILLED</option>
              <option value="REJECTED">REJECTED</option>
              <option value="PARTIAL">PARTIAL</option>
            </Select>
          </div>
          <Button onClick={refresh} disabled={loading}>
            Filtra
          </Button>
        </div>
      </Card>

      <Card>
        <CardTitle>Execution log ({logs.length})</CardTitle>
        {logs.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">Nessun log.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {logs.map((log) => (
              <li
                key={log.id}
                className="rounded-lg border border-slate-800 bg-slate-900/40 p-3 text-sm"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="muted">{log.mode}</Badge>
                  <Badge
                    variant={log.status === "FILLED" ? "success" : "warning"}
                  >
                    {log.status}
                  </Badge>
                  <span className="text-white">
                    {log.order.side} {log.order.quantity} {log.order.symbol}
                  </span>
                  {log.order.riskLevel && (
                    <span className="text-slate-400">
                      Risk: {log.order.riskLevel}
                      {log.order.riskBlocked ? " (blocked)" : ""}
                    </span>
                  )}
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  {new Date(log.createdAt).toLocaleString("it-IT")}
                  {log.fillPrice !== null &&
                    ` · Fill ${formatCurrency(log.fillPrice)}`}
                  {log.realizedPnl !== null &&
                    ` · Realized ${formatCurrency(log.realizedPnl)}`}
                </p>
                <p className="mt-1 text-xs text-slate-400">{log.message}</p>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
