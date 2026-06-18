"use client";

import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "@/components/ui/Button";
import { Card, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Select } from "@/components/ui/Select";
import { apiFetch } from "@/lib/client/apiFetch";
import type { ResearchSummary } from "@/lib/research";
import { formatPct } from "@/lib/utils";

const TIMEFRAMES = [30, 90, 180, 365] as const;

interface PriceHistoryResponse {
  symbol: string;
  days: number;
  dataSource: string;
  warning?: string;
  bars: Array<{ date: string; close: number }>;
}

export function ResearchClient({ initial }: { initial: ResearchSummary }) {
  const [summary, setSummary] = useState(initial);
  const [symbols, setSymbols] = useState(
    initial.assets.map((a) => a.symbol).join(","),
  );
  const [periodDays, setPeriodDays] = useState(initial.periodDays);
  const [chartSymbol, setChartSymbol] = useState(
    initial.assets[0]?.symbol ?? "BTC",
  );
  const [priceHistory, setPriceHistory] = useState<PriceHistoryResponse | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [importCsv, setImportCsv] = useState("");
  const [importSymbol, setImportSymbol] = useState(
    initial.assets[0]?.symbol ?? "BTC",
  );
  const [importPreview, setImportPreview] = useState<{
    rows: Array<{ date: string; close: number; symbol?: string }>;
    errors: Array<{ line: number; message: string }>;
  } | null>(null);
  const [importing, setImporting] = useState(false);

  async function refresh() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (symbols.trim()) params.set("symbols", symbols.trim());
      params.set("days", String(periodDays));
      const res = await fetch(`/api/research/summary?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Errore");
      setSummary(data as ResearchSummary);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Errore");
    } finally {
      setLoading(false);
    }
  }

  async function loadPriceHistory(symbol: string, days: number) {
    setHistoryLoading(true);
    try {
      const params = new URLSearchParams({ symbol, days: String(days) });
      const res = await fetch(`/api/research/history?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Errore storico");
      setPriceHistory(data as PriceHistoryResponse);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Errore");
      setPriceHistory(null);
    } finally {
      setHistoryLoading(false);
    }
  }

  useEffect(() => {
    if (!chartSymbol) return;
    void (async () => {
      setHistoryLoading(true);
      try {
        const params = new URLSearchParams({
          symbol: chartSymbol,
          days: String(periodDays),
        });
        const res = await fetch(`/api/research/history?${params.toString()}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Errore storico");
        setPriceHistory(data as PriceHistoryResponse);
      } catch {
        setPriceHistory(null);
      } finally {
        setHistoryLoading(false);
      }
    })();
  }, [chartSymbol, periodDays]);

  async function previewImport() {
    setImporting(true);
    try {
      const res = await apiFetch("/api/research/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "preview",
          csv: importCsv,
          defaultSymbol: importSymbol,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(JSON.stringify(data.error ?? data));
      setImportPreview(data);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Errore preview");
    } finally {
      setImporting(false);
    }
  }

  async function commitImport() {
    if (!importPreview?.rows.length) return;
    setImporting(true);
    try {
      const res = await apiFetch("/api/research/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "commit",
          defaultSymbol: importSymbol,
          rows: importPreview.rows,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(JSON.stringify(data.error ?? data));
      alert(`Importati ${data.imported} barre storiche.`);
      setImportCsv("");
      setImportPreview(null);
      if (chartSymbol) void loadPriceHistory(chartSymbol, periodDays);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Errore import");
    } finally {
      setImporting(false);
    }
  }

  const corrSymbols = Object.keys(summary.correlation);
  const chartData = summary.assets.map((a) => ({
    symbol: a.symbol,
    returnPct: a.returnPct ?? 0,
    volatilityPct: a.volatilityPct ?? 0,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">Research</h2>
        <p className="text-sm text-slate-400">
          Analisi non esecutiva — rendimenti, volatilità, drawdown e correlazioni
          ({summary.periodDays} giorni). Nessun ordine.
        </p>
      </div>

      <Card>
        <CardTitle>Parametri</CardTitle>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <div className="min-w-[200px] flex-1">
            <Label>Simboli (CSV)</Label>
            <Input
              value={symbols}
              onChange={(e) => setSymbols(e.target.value)}
              placeholder="BTC,SWDA,EIMI"
            />
          </div>
          <div className="w-36">
            <Label>Timeframe</Label>
            <Select
              value={String(periodDays)}
              onChange={(e) => setPeriodDays(parseInt(e.target.value, 10))}
            >
              {TIMEFRAMES.map((d) => (
                <option key={d} value={d}>
                  {d} giorni
                </option>
              ))}
            </Select>
          </div>
          <Button onClick={refresh} disabled={loading}>
            {loading ? "Caricamento…" : "Aggiorna"}
          </Button>
        </div>
      </Card>

      <Card>
        <CardTitle>Serie prezzi</CardTitle>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <div className="w-40">
            <Label>Asset chart</Label>
            <Select
              value={chartSymbol}
              onChange={(e) => setChartSymbol(e.target.value)}
            >
              {summary.assets.map((a) => (
                <option key={a.symbol} value={a.symbol}>
                  {a.symbol}
                </option>
              ))}
            </Select>
          </div>
          {priceHistory && (
            <p className="text-sm text-slate-400">
              Fonte: {priceHistory.dataSource}
              {priceHistory.warning ? ` — ${priceHistory.warning}` : ""}
            </p>
          )}
        </div>
        <div className="mt-4 h-64">
          {historyLoading ? (
            <p className="text-sm text-slate-500">Caricamento serie…</p>
          ) : priceHistory && priceHistory.bars.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={priceHistory.bars}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis
                  dataKey="date"
                  tick={{ fill: "#94a3b8", fontSize: 10 }}
                  minTickGap={30}
                />
                <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="close"
                  name="Close"
                  stroke="#22c55e"
                  dot={false}
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-slate-500">Nessun dato prezzo.</p>
          )}
        </div>
      </Card>

      <Card>
        <CardTitle>Import storico CSV</CardTitle>
        <p className="mt-2 text-sm text-slate-400">
          Formato: <code className="text-slate-300">date,close</code> oppure{" "}
          <code className="text-slate-300">symbol,date,close</code>
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <Label>Simbolo default (se assente nel CSV)</Label>
            <Input
              value={importSymbol}
              onChange={(e) => setImportSymbol(e.target.value.toUpperCase())}
            />
          </div>
        </div>
        <div className="mt-3">
          <Label>CSV</Label>
          <textarea
            className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 p-3 font-mono text-sm text-slate-200"
            rows={6}
            value={importCsv}
            onChange={(e) => setImportCsv(e.target.value)}
            placeholder={"date,close\n2024-01-01,100.5\n2024-01-02,101.2"}
          />
        </div>
        <div className="mt-3 flex gap-2">
          <Button
            variant="secondary"
            onClick={previewImport}
            disabled={importing || !importCsv.trim()}
          >
            Anteprima
          </Button>
          <Button
            onClick={commitImport}
            disabled={importing || !importPreview?.rows.length}
          >
            Conferma import
          </Button>
        </div>
        {importPreview && (
          <p className="mt-2 text-sm text-slate-400">
            {importPreview.rows.length} righe valide
            {importPreview.errors.length > 0
              ? `, ${importPreview.errors.length} errori`
              : ""}
          </p>
        )}
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardTitle>Rendimento periodo</CardTitle>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="symbol" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <Tooltip />
                <Bar dataKey="returnPct" fill="#3b82f6" name="Return %" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <CardTitle>Benchmark vs portfolio medio</CardTitle>
          <div className="mt-3 space-y-2 text-sm text-slate-300">
            <p>
              Benchmark ({summary.benchmark.symbol}):{" "}
              {summary.benchmark.returnPct !== null
                ? formatPct(summary.benchmark.returnPct)
                : "n/d"}
            </p>
            <p>
              Media asset selezionati:{" "}
              {summary.benchmark.portfolioAvgReturnPct !== null
                ? formatPct(summary.benchmark.portfolioAvgReturnPct)
                : "n/d"}
            </p>
            <p>
              Outperformance:{" "}
              {summary.benchmark.comparison.outperformancePct !== null
                ? formatPct(summary.benchmark.comparison.outperformancePct)
                : "n/d"}
            </p>
            <p className="text-slate-500">{summary.benchmark.comparison.note}</p>
          </div>
        </Card>
      </div>

      <Card>
        <CardTitle>Metriche per asset</CardTitle>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-400">
                <th className="p-2">Symbol</th>
                <th className="p-2">Return</th>
                <th className="p-2">Vol</th>
                <th className="p-2">Max DD</th>
                <th className="p-2">Curr DD</th>
                <th className="p-2">Source</th>
              </tr>
            </thead>
            <tbody>
              {summary.assets.map((a) => (
                <tr key={a.symbol} className="border-t border-slate-800">
                  <td className="p-2 text-white">{a.symbol}</td>
                  <td className="p-2">
                    {a.returnPct !== null ? formatPct(a.returnPct) : "n/d"}
                  </td>
                  <td className="p-2">
                    {a.volatilityPct !== null
                      ? formatPct(a.volatilityPct)
                      : "n/d"}
                  </td>
                  <td className="p-2">{formatPct(a.maxDrawdownPct)}</td>
                  <td className="p-2">{formatPct(a.currentDrawdownPct)}</td>
                  <td className="p-2 text-slate-400">{a.dataSource}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {corrSymbols.length > 1 && (
        <Card>
          <CardTitle>Correlazione rendimenti (Pearson)</CardTitle>
          <div className="mt-3 overflow-x-auto">
            <table className="text-sm">
              <thead>
                <tr>
                  <th className="p-2" />
                  {corrSymbols.map((s) => (
                    <th key={s} className="p-2 text-slate-400">
                      {s}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {corrSymbols.map((row) => (
                  <tr key={row}>
                    <td className="p-2 font-medium text-white">{row}</td>
                    {corrSymbols.map((col) => (
                      <td key={col} className="p-2 text-slate-300">
                        {summary.correlation[row][col] !== null
                          ? summary.correlation[row][col]!.toFixed(2)
                          : "—"}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
