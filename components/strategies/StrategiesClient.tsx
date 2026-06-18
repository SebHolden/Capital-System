"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardTitle } from "@/components/ui/Card";
import { formatPct } from "@/lib/utils";
import { apiFetch } from "@/lib/client/apiFetch";

interface StrategyRow {
  id: string;
  name: string;
  type: string;
  status: string;
  primaryAsset: { symbol: string; name: string } | null;
  paperEligible: boolean;
  paperEligibilityReasons: string[];
  signalCount: number;
  promotedAt: string | null;
  latestBacktest: {
    metrics: {
      totalReturnPct: number;
      maxDrawdownPct: number;
    } | null;
  } | null;
}

interface PaperSignalRow {
  id: string;
  signalDate: string;
  signalType: string;
  plannedEntry: number;
  currentResultPct: number | null;
  result7dPct: number | null;
  result30dPct: number | null;
  maePct: number | null;
  mfePct: number | null;
  ruleFollowed: boolean;
  status: string;
  strategy: { name: string };
  asset: { symbol: string };
}

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Bozza",
  BACKTESTED: "Backtestata",
  PAPER_ACTIVE: "Paper attivo",
  PROMOTED: "Promossa",
  REJECTED: "Rifiutata",
};

function statusClass(status: string): string {
  switch (status) {
    case "PROMOTED":
      return "text-green-400";
    case "PAPER_ACTIVE":
      return "text-blue-400";
    case "BACKTESTED":
      return "text-slate-300";
    case "REJECTED":
      return "text-red-400";
    default:
      return "text-slate-400";
  }
}

export function StrategiesClient({
  initialStrategies,
  initialSignals,
}: {
  initialStrategies: StrategyRow[];
  initialSignals: PaperSignalRow[];
}) {
  const [strategies, setStrategies] = useState(initialStrategies);
  const [signals, setSignals] = useState(initialSignals);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function reload() {
    const [strategiesRes, signalsRes] = await Promise.all([
      fetch("/api/strategies"),
      fetch("/api/paper-signals"),
    ]);
    const strategiesData = await strategiesRes.json();
    const signalsData = await signalsRes.json();
    if (strategiesRes.ok) setStrategies(strategiesData.strategies);
    if (signalsRes.ok) setSignals(signalsData.signals);
  }

  async function activatePaper(strategyId: string) {
    setLoading(true);
    setMessage(null);
    try {
      const res = await apiFetch(`/api/strategies/${strategyId}/activate-paper`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(
          data.reasons?.join(" ") ?? data.error ?? "Attivazione fallita",
        );
      }
      setMessage("Paper trading attivato per la strategia.");
      await reload();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Errore attivazione");
    } finally {
      setLoading(false);
    }
  }

  async function generateSignals() {
    setLoading(true);
    setMessage(null);
    try {
      const res = await apiFetch("/api/paper-signals/generate", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Generazione fallita");
      setMessage(`Segnali creati: ${data.created}, saltati: ${data.skipped}`);
      await reload();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Errore generazione");
    } finally {
      setLoading(false);
    }
  }

  async function refreshMonitor() {
    setLoading(true);
    setMessage(null);
    try {
      const res = await apiFetch("/api/paper-signals/refresh", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Refresh fallito");
      const promoted =
        data.promoted?.length > 0
          ? ` Promosse: ${data.promoted.length}.`
          : "";
      setMessage(`Monitor aggiornato: ${data.updated} segnali.${promoted}`);
      await reload();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Errore refresh");
    } finally {
      setLoading(false);
    }
  }

  const promotedStrategies = strategies.filter((s) => s.status === "PROMOTED");

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">Strategie</h2>
        <p className="text-sm text-slate-400">
          Paper trading signals — monitor senza esecuzione ordini (M8)
        </p>
      </div>

      {promotedStrategies.length > 0 && (
        <div className="rounded-lg border border-green-800/50 bg-green-950/30 p-3 text-sm text-green-300">
          Strategie promosse:{" "}
          {promotedStrategies.map((s) => s.name).join(", ")} — prerequisito per
          live trading (M9).
        </div>
      )}

      {message && (
        <div className="rounded-lg border border-slate-700 bg-slate-900 p-3 text-sm text-slate-300">
          {message}
        </div>
      )}

      <Card>
        <CardTitle>Azioni</CardTitle>
        <div className="mt-4 flex flex-wrap gap-3">
          <Button onClick={generateSignals} disabled={loading}>
            Genera segnali
          </Button>
          <Button variant="secondary" onClick={refreshMonitor} disabled={loading}>
            Aggiorna monitor
          </Button>
        </div>
      </Card>

      <Card>
        <CardTitle>Strategie</CardTitle>
        {strategies.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">
            Nessuna strategia. Esegui un backtest dalla pagina Backtest.
          </p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700 text-left text-slate-500">
                  <th className="pb-2 pr-4">Nome</th>
                  <th className="pb-2 pr-4">Status</th>
                  <th className="pb-2 pr-4">Asset</th>
                  <th className="pb-2 pr-4">Backtest</th>
                  <th className="pb-2 pr-4">Segnali</th>
                  <th className="pb-2">Azioni</th>
                </tr>
              </thead>
              <tbody>
                {strategies.map((strategy) => (
                  <tr key={strategy.id} className="border-b border-slate-800">
                    <td className="py-2 pr-4 text-slate-300">{strategy.name}</td>
                    <td className={`py-2 pr-4 ${statusClass(strategy.status)}`}>
                      {STATUS_LABELS[strategy.status] ?? strategy.status}
                    </td>
                    <td className="py-2 pr-4 text-slate-400">
                      {strategy.primaryAsset?.symbol ?? "—"}
                    </td>
                    <td className="py-2 pr-4 text-slate-400">
                      {strategy.latestBacktest?.metrics
                        ? `${formatPct(strategy.latestBacktest.metrics.totalReturnPct)} / DD ${formatPct(strategy.latestBacktest.metrics.maxDrawdownPct)}`
                        : "—"}
                    </td>
                    <td className="py-2 pr-4 text-slate-400">
                      {strategy.signalCount}
                    </td>
                    <td className="py-2">
                      {strategy.status !== "PAPER_ACTIVE" &&
                        strategy.status !== "PROMOTED" && (
                          <Button
                            variant="secondary"
                            disabled={
                              loading ||
                              !strategy.paperEligible ||
                              strategy.status === "REJECTED"
                            }
                            onClick={() => activatePaper(strategy.id)}
                            title={
                              strategy.paperEligible
                                ? undefined
                                : strategy.paperEligibilityReasons.join("; ")
                            }
                          >
                            Attiva paper
                          </Button>
                        )}
                      {!strategy.paperEligible &&
                        strategy.status !== "PAPER_ACTIVE" &&
                        strategy.status !== "PROMOTED" && (
                          <p className="mt-1 text-xs text-amber-400">
                            {strategy.paperEligibilityReasons[0]}
                          </p>
                        )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card>
        <CardTitle>Segnali paper</CardTitle>
        {signals.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">
            Nessun segnale. Attiva paper su una strategia e genera segnali.
          </p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700 text-left text-slate-500">
                  <th className="pb-2 pr-4">Data</th>
                  <th className="pb-2 pr-4">Strategia</th>
                  <th className="pb-2 pr-4">Asset</th>
                  <th className="pb-2 pr-4">Tipo</th>
                  <th className="pb-2 pr-4">Current</th>
                  <th className="pb-2 pr-4">7d</th>
                  <th className="pb-2 pr-4">30d</th>
                  <th className="pb-2 pr-4">MAE</th>
                  <th className="pb-2 pr-4">MFE</th>
                  <th className="pb-2">Rule</th>
                </tr>
              </thead>
              <tbody>
                {signals.map((signal) => (
                  <tr key={signal.id} className="border-b border-slate-800">
                    <td className="py-2 pr-4 text-slate-300">
                      {new Date(signal.signalDate).toLocaleDateString("it-IT")}
                    </td>
                    <td className="py-2 pr-4 text-slate-300">
                      {signal.strategy.name}
                    </td>
                    <td className="py-2 pr-4 text-slate-400">
                      {signal.asset.symbol}
                    </td>
                    <td className="py-2 pr-4 text-slate-400">
                      {signal.signalType}
                    </td>
                    <td className="py-2 pr-4 text-slate-400">
                      {signal.currentResultPct !== null
                        ? formatPct(signal.currentResultPct)
                        : "—"}
                    </td>
                    <td className="py-2 pr-4 text-slate-400">
                      {signal.result7dPct !== null
                        ? formatPct(signal.result7dPct)
                        : "—"}
                    </td>
                    <td className="py-2 pr-4 text-slate-400">
                      {signal.result30dPct !== null
                        ? formatPct(signal.result30dPct)
                        : "—"}
                    </td>
                    <td className="py-2 pr-4 text-red-400">
                      {signal.maePct !== null ? formatPct(signal.maePct) : "—"}
                    </td>
                    <td className="py-2 pr-4 text-green-400">
                      {signal.mfePct !== null ? formatPct(signal.mfePct) : "—"}
                    </td>
                    <td className="py-2 text-slate-400">
                      {signal.ruleFollowed ? "Sì" : "No"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <p className="text-xs text-slate-500">
        I segnali paper non eseguono ordini. Usa{" "}
        <code className="text-slate-400">npm run paper-signals:run</code> per
        scheduler locale (cron / Task Scheduler).
      </p>
    </div>
  );
}
