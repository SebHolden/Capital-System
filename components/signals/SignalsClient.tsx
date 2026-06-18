"use client";

import Link from "next/link";
import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardTitle } from "@/components/ui/Card";
import { Select } from "@/components/ui/Select";
import { formatPct } from "@/lib/utils";

interface SignalRow {
  id: string;
  signalDate: string;
  signalType: string;
  plannedEntry: number;
  currentResultPct: number | null;
  result1dPct: number | null;
  result7dPct: number | null;
  result30dPct: number | null;
  maePct: number | null;
  mfePct: number | null;
  ruleFollowed: boolean;
  status: string;
  outcome: string;
  closeReason: string | null;
  reason: string;
  strategy: {
    id: string;
    name: string;
    evaluationScore?: number | null;
    rating?: string | null;
  };
  asset: { symbol: string };
}

function outcomeVariant(
  outcome: string,
): "success" | "danger" | "warning" | "muted" | "default" {
  switch (outcome) {
    case "WIN":
      return "success";
    case "LOSS":
      return "danger";
    case "FLAT":
      return "muted";
    case "EXPIRED":
    case "INSUFFICIENT_DATA":
      return "warning";
    default:
      return "default";
  }
}

export function SignalsClient({ initialSignals }: { initialSignals: SignalRow[] }) {
  const [signals, setSignals] = useState(initialSignals);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [loading, setLoading] = useState(false);

  async function refresh() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      const res = await fetch(`/api/paper-signals?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSignals(
        data.signals.map((s: SignalRow & { strategy: { id: string; name: string } }) => ({
          ...s,
          signalDate: s.signalDate,
        })),
      );
    } catch (err) {
      alert(err instanceof Error ? err.message : "Errore");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">Segnali paper</h2>
        <p className="text-sm text-slate-400">
          Monitor segnali strategia — sola lettura, nessuna esecuzione ordini.
          Attivazione strategie in{" "}
          <Link href="/strategies" className="text-blue-400 hover:underline">
            Strategie
          </Link>
          .
        </p>
      </div>

      <Card>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1 block text-xs text-slate-400">Stato</label>
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">Tutti</option>
              <option value="OPEN">OPEN</option>
              <option value="CLOSED">CLOSED</option>
              <option value="EXPIRED">EXPIRED</option>
            </Select>
          </div>
          <Button onClick={refresh} disabled={loading}>
            Aggiorna
          </Button>
        </div>
      </Card>

      <Card>
        <CardTitle>Segnali ({signals.length})</CardTitle>
        {signals.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">Nessun segnale.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-400">
                  <th className="p-2">Data</th>
                  <th className="p-2">Strategia</th>
                  <th className="p-2">Asset</th>
                  <th className="p-2">Tipo</th>
                  <th className="p-2">Stato</th>
                  <th className="p-2">Current</th>
                  <th className="p-2">1d</th>
                  <th className="p-2">7d</th>
                  <th className="p-2">30d</th>
                  <th className="p-2">MAE/MFE</th>
                  <th className="p-2">Outcome</th>
                  <th className="p-2">Score strat.</th>
                  <th className="p-2">Rule</th>
                </tr>
              </thead>
              <tbody>
                {signals.map((s) => (
                  <tr key={s.id} className="border-t border-slate-800">
                    <td className="p-2 text-slate-300">
                      {new Date(s.signalDate).toLocaleDateString("it-IT")}
                    </td>
                    <td className="p-2 text-white">{s.strategy.name}</td>
                    <td className="p-2">{s.asset.symbol}</td>
                    <td className="p-2">{s.signalType}</td>
                    <td className="p-2">
                      <Badge variant="muted">{s.status}</Badge>
                      {s.closeReason && (
                        <span className="ml-1 text-xs text-slate-500">
                          {s.closeReason}
                        </span>
                      )}
                    </td>
                    <td className="p-2">
                      {s.currentResultPct !== null
                        ? formatPct(s.currentResultPct)
                        : "—"}
                    </td>
                    <td className="p-2">
                      {s.result1dPct !== null ? formatPct(s.result1dPct) : "—"}
                    </td>
                    <td className="p-2">
                      {s.result7dPct !== null ? formatPct(s.result7dPct) : "—"}
                    </td>
                    <td className="p-2">
                      {s.result30dPct !== null ? formatPct(s.result30dPct) : "—"}
                    </td>
                    <td className="p-2 text-xs text-slate-400">
                      {s.maePct !== null ? formatPct(s.maePct) : "—"} /{" "}
                      {s.mfePct !== null ? formatPct(s.mfePct) : "—"}
                    </td>
                    <td className="p-2">
                      <Badge variant={outcomeVariant(s.outcome)}>{s.outcome}</Badge>
                    </td>
                    <td className="p-2 text-slate-400">
                      {s.strategy.evaluationScore != null
                        ? `${s.strategy.evaluationScore}${s.strategy.rating ? ` (${s.strategy.rating})` : ""}`
                        : "—"}
                    </td>
                    <td className="p-2">
                      {s.ruleFollowed ? (
                        <span className="text-green-400">Sì</span>
                      ) : (
                        <span className="text-red-400">No</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
