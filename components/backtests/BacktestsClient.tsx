"use client";

import { useMemo, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "@/components/ui/Button";
import { apiFetch } from "@/lib/client/apiFetch";
import { Card, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Select } from "@/components/ui/Select";
import { formatCurrency, formatPct } from "@/lib/utils";

interface Asset {
  id: string;
  symbol: string;
  name: string;
}

interface BacktestRunSummary {
  id: string;
  status: string;
  dataSource: string;
  initialCapital: number;
  startDate: string;
  endDate: string;
  createdAt: string;
  strategy: { name: string; type: string };
  asset: { symbol: string; name: string };
  _count: { trades: number };
}

interface PerformanceMetrics {
  totalReturnPct: number;
  cagrPct: number;
  volatilityPct: number;
  maxDrawdownPct: number;
  sharpeRatio: number;
  sortinoRatio: number;
  winRatePct: number;
  tradeCount: number;
  avgHoldingDays: number;
  worstMonthPct: number;
  bestMonthPct: number;
  recoveryDays: number | null;
  finalValue: number;
}

interface WalkForwardFold {
  foldIndex: number;
  trainStartDate: string;
  trainEndDate: string;
  testStartDate: string;
  testEndDate: string;
  inSample: PerformanceMetrics;
  outOfSample: PerformanceMetrics;
}

interface WalkForwardResult {
  folds: WalkForwardFold[];
  aggregate: {
    foldCount: number;
    avgInSampleReturnPct: number;
    avgOutOfSampleReturnPct: number;
    avgInSampleMaxDrawdownPct: number;
    avgOutOfSampleMaxDrawdownPct: number;
  } | null;
}

interface BacktestDetail {
  id: string;
  status: string;
  dataSource: string;
  warning?: string;
  initialCapital: number;
  startDate: string;
  endDate: string;
  strategy: { name: string; type: string };
  asset: { symbol: string; name: string };
  metrics: PerformanceMetrics & {
    outOfSample?: PerformanceMetrics | null;
    walkForward?: WalkForwardResult;
  };
  benchmark: PerformanceMetrics | null;
  equityCurve: Array<{ date: string; value: number }>;
  trades: Array<{
    id: string;
    date: string;
    side: string;
    quantity: number;
    price: number;
    fees: number;
    reason: string;
  }>;
}

const STRATEGY_LABELS: Record<string, string> = {
  DCA_MONTHLY: "DCA mensile",
  REBALANCE_MONTHLY: "Ribilanciamento mensile",
  MOVING_AVERAGE_CROSS: "Moving average cross",
  MOMENTUM: "Momentum",
  BUY_THE_DIP: "Buy the dip",
  VOLATILITY_FILTER: "Volatility filter",
  CORE_SATELLITE: "Core satellite",
};

function defaultStartDate(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 1);
  return d.toISOString().slice(0, 10);
}

function defaultEndDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function MetricsTable({
  title,
  metrics,
}: {
  title: string;
  metrics: PerformanceMetrics;
}) {
  const rows = [
    ["Rendimento totale", formatPct(metrics.totalReturnPct)],
    ["CAGR", formatPct(metrics.cagrPct)],
    ["Volatilità", formatPct(metrics.volatilityPct)],
    ["Max drawdown", formatPct(metrics.maxDrawdownPct)],
    ["Sharpe", metrics.sharpeRatio.toFixed(2)],
    ["Sortino", metrics.sortinoRatio.toFixed(2)],
    ["Win rate", formatPct(metrics.winRatePct)],
    ["Trade", String(metrics.tradeCount)],
    ["Holding medio (gg)", metrics.avgHoldingDays.toFixed(1)],
    ["Mese peggiore", formatPct(metrics.worstMonthPct)],
    ["Mese migliore", formatPct(metrics.bestMonthPct)],
    [
      "Recovery (gg)",
      metrics.recoveryDays !== null ? String(metrics.recoveryDays) : "—",
    ],
    ["Valore finale", formatCurrency(metrics.finalValue)],
  ];

  return (
    <div>
      <p className="mb-2 text-sm font-medium text-slate-300">{title}</p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <tbody>
            {rows.map(([label, value]) => (
              <tr key={label} className="border-b border-slate-800">
                <td className="py-2 pr-4 text-slate-400">{label}</td>
                <td className="py-2 text-white">{value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function BacktestsClient({
  assets,
  initialRuns,
}: {
  assets: Asset[];
  initialRuns: BacktestRunSummary[];
}) {
  const [runs, setRuns] = useState(initialRuns);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<BacktestDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    strategyType: "DCA_MONTHLY",
    assetId: assets[0]?.id ?? "",
    rebalanceAssetId2: assets[1]?.id ?? "",
    startDate: defaultStartDate(),
    endDate: defaultEndDate(),
    initialCapital: "10000",
    monthlyAmountEur: "250",
    fastPeriod: "20",
    slowPeriod: "50",
    walkForwardEnabled: false,
    trainBars: "60",
    testBars: "30",
    stepBars: "30",
  });

  const chartData = useMemo(() => {
    if (!detail) return [];
    return detail.equityCurve.map((point) => ({
      date: point.date,
      strategy: point.value,
    }));
  }, [detail]);

  async function loadDetail(id: string) {
    setSelectedId(id);
    setLoading(true);
    try {
      const res = await fetch(`/api/backtests/${id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(JSON.stringify(data.error));
      setDetail(data.run);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Errore caricamento dettaglio");
    } finally {
      setLoading(false);
    }
  }

  async function runBacktest() {
    setLoading(true);
    try {
      const config: Record<string, unknown> = {};
      let rebalanceAssetIds: string[] | undefined;

      if (form.strategyType === "DCA_MONTHLY") {
        config.monthlyAmountEur = parseFloat(form.monthlyAmountEur);
      } else if (form.strategyType === "MOVING_AVERAGE_CROSS") {
        config.fastPeriod = parseInt(form.fastPeriod, 10);
        config.slowPeriod = parseInt(form.slowPeriod, 10);
        config.positionPct = 0.95;
      } else if (form.strategyType === "REBALANCE_MONTHLY") {
        const ids = [form.assetId];
        if (form.rebalanceAssetId2 && form.rebalanceAssetId2 !== form.assetId) {
          ids.push(form.rebalanceAssetId2);
        }
        rebalanceAssetIds = ids;
        const weight = 1 / ids.length;
        config.targetWeights = Object.fromEntries(ids.map((id) => [id, weight]));
      }

      const res = await apiFetch("/api/backtests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          strategyType: form.strategyType,
          assetId: form.assetId,
          startDate: form.startDate,
          endDate: form.endDate,
          initialCapital: parseFloat(form.initialCapital),
          config,
          rebalanceAssetIds,
          walkForward: form.walkForwardEnabled
            ? {
                enabled: true,
                trainBars: parseInt(form.trainBars, 10),
                testBars: parseInt(form.testBars, 10),
                stepBars: parseInt(form.stepBars, 10),
              }
            : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(JSON.stringify(data.error ?? data));

      const listRes = await fetch("/api/backtests");
      const listData = await listRes.json();
      if (listRes.ok) setRuns(listData.runs);

      await loadDetail(data.runId);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Errore backtest");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">Backtest</h2>
        <p className="text-sm text-slate-400">
          Test strategie DCA, ribilanciamento e moving average con metriche e
          benchmark buy-and-hold
        </p>
      </div>

      <Card>
        <CardTitle>Nuovo backtest</CardTitle>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <Label>Strategia</Label>
            <Select
              value={form.strategyType}
              onChange={(e) =>
                setForm({ ...form, strategyType: e.target.value })
              }
            >
              {Object.entries(STRATEGY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Asset principale</Label>
            <Select
              value={form.assetId}
              onChange={(e) => setForm({ ...form, assetId: e.target.value })}
            >
              {assets.map((asset) => (
                <option key={asset.id} value={asset.id}>
                  {asset.symbol} — {asset.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Data inizio</Label>
            <Input
              type="date"
              value={form.startDate}
              onChange={(e) =>
                setForm({ ...form, startDate: e.target.value })
              }
            />
          </div>
          <div>
            <Label>Data fine</Label>
            <Input
              type="date"
              value={form.endDate}
              onChange={(e) => setForm({ ...form, endDate: e.target.value })}
            />
          </div>
          <div>
            <Label>Capitale iniziale (€)</Label>
            <Input
              type="number"
              value={form.initialCapital}
              onChange={(e) =>
                setForm({ ...form, initialCapital: e.target.value })
              }
            />
          </div>

          {form.strategyType === "DCA_MONTHLY" && (
            <div>
              <Label>Importo mensile (€)</Label>
              <Input
                type="number"
                value={form.monthlyAmountEur}
                onChange={(e) =>
                  setForm({ ...form, monthlyAmountEur: e.target.value })
                }
              />
            </div>
          )}

          {form.strategyType === "MOVING_AVERAGE_CROSS" && (
            <>
              <div>
                <Label>SMA veloce</Label>
                <Input
                  type="number"
                  value={form.fastPeriod}
                  onChange={(e) =>
                    setForm({ ...form, fastPeriod: e.target.value })
                  }
                />
              </div>
              <div>
                <Label>SMA lenta</Label>
                <Input
                  type="number"
                  value={form.slowPeriod}
                  onChange={(e) =>
                    setForm({ ...form, slowPeriod: e.target.value })
                  }
                />
              </div>
            </>
          )}

          {form.strategyType === "REBALANCE_MONTHLY" && (
            <div>
              <Label>Secondo asset (opzionale)</Label>
              <Select
                value={form.rebalanceAssetId2}
                onChange={(e) =>
                  setForm({ ...form, rebalanceAssetId2: e.target.value })
                }
              >
                <option value="">— Solo asset principale —</option>
                {assets
                  .filter((a) => a.id !== form.assetId)
                  .map((asset) => (
                    <option key={asset.id} value={asset.id}>
                      {asset.symbol} — {asset.name}
                    </option>
                  ))}
              </Select>
            </div>
          )}
        </div>

        <div className="mt-4 space-y-3 rounded-lg border border-slate-800 p-4">
          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={form.walkForwardEnabled}
              onChange={(e) =>
                setForm({ ...form, walkForwardEnabled: e.target.checked })
              }
            />
            Walk-forward rolling (IS/OOS per fold)
          </label>
          {form.walkForwardEnabled && (
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <Label>Train bars</Label>
                <Input
                  type="number"
                  value={form.trainBars}
                  onChange={(e) =>
                    setForm({ ...form, trainBars: e.target.value })
                  }
                />
              </div>
              <div>
                <Label>Test bars</Label>
                <Input
                  type="number"
                  value={form.testBars}
                  onChange={(e) =>
                    setForm({ ...form, testBars: e.target.value })
                  }
                />
              </div>
              <div>
                <Label>Step bars</Label>
                <Input
                  type="number"
                  value={form.stepBars}
                  onChange={(e) =>
                    setForm({ ...form, stepBars: e.target.value })
                  }
                />
              </div>
            </div>
          )}
        </div>

        <div className="mt-4">
          <Button onClick={runBacktest} disabled={loading || !form.assetId}>
            Esegui backtest
          </Button>
        </div>
      </Card>

      <Card>
        <CardTitle>Run recenti</CardTitle>
        {runs.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">Nessun backtest eseguito.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700 text-left text-slate-500">
                  <th className="pb-2 pr-4">Data</th>
                  <th className="pb-2 pr-4">Strategia</th>
                  <th className="pb-2 pr-4">Asset</th>
                  <th className="pb-2 pr-4">Fonte dati</th>
                  <th className="pb-2 pr-4">Trade</th>
                  <th className="pb-2">Azioni</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((run) => (
                  <tr key={run.id} className="border-b border-slate-800">
                    <td className="py-2 pr-4 text-slate-300">
                      {new Date(run.createdAt).toLocaleDateString("it-IT")}
                    </td>
                    <td className="py-2 pr-4 text-slate-300">
                      {run.strategy.name}
                    </td>
                    <td className="py-2 pr-4 text-slate-300">
                      {run.asset.symbol}
                    </td>
                    <td className="py-2 pr-4 text-slate-400">
                      {run.dataSource}
                    </td>
                    <td className="py-2 pr-4 text-slate-400">
                      {run._count.trades}
                    </td>
                    <td className="py-2">
                      <Button
                        variant="secondary"
                        onClick={() => loadDetail(run.id)}
                        disabled={loading}
                      >
                        Dettaglio
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {detail && selectedId === detail.id && (
        <>
          {detail.dataSource === "synthetic" && (
            <div className="rounded-lg border border-amber-800/50 bg-amber-950/30 p-3 text-sm text-amber-300">
              Serie storica sintetica: i risultati sono indicativi. Per dati
              reali usa BTC o simboli USA con FINNHUB_API_KEY.
            </div>
          )}

          <Card>
            <CardTitle>
              {detail.strategy.name} — {detail.asset.symbol}
            </CardTitle>
            <div className="mt-4 grid gap-6 lg:grid-cols-2">
              <MetricsTable title="Strategia" metrics={detail.metrics} />
              {detail.benchmark && (
                <MetricsTable title="Benchmark (buy & hold)" metrics={detail.benchmark} />
              )}
            </div>
          </Card>

          {detail.metrics.walkForward &&
            detail.metrics.walkForward.folds.length > 0 && (
              <Card>
                <CardTitle>Walk-forward IS/OOS</CardTitle>
                {detail.metrics.walkForward.aggregate && (
                  <p className="mt-2 text-sm text-slate-400">
                    {detail.metrics.walkForward.aggregate.foldCount} fold — IS
                    medio{" "}
                    {formatPct(
                      detail.metrics.walkForward.aggregate
                        .avgInSampleReturnPct,
                    )}
                    , OOS medio{" "}
                    {formatPct(
                      detail.metrics.walkForward.aggregate
                        .avgOutOfSampleReturnPct,
                    )}
                  </p>
                )}
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-700 text-left text-slate-500">
                        <th className="pb-2 pr-4">Fold</th>
                        <th className="pb-2 pr-4">Test period</th>
                        <th className="pb-2 pr-4">IS return</th>
                        <th className="pb-2 pr-4">OOS return</th>
                        <th className="pb-2 pr-4">IS max DD</th>
                        <th className="pb-2">OOS max DD</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.metrics.walkForward.folds.map((fold) => (
                        <tr
                          key={fold.foldIndex}
                          className="border-b border-slate-800"
                        >
                          <td className="py-2 pr-4 text-slate-300">
                            {fold.foldIndex}
                          </td>
                          <td className="py-2 pr-4 text-slate-400">
                            {fold.testStartDate} → {fold.testEndDate}
                          </td>
                          <td className="py-2 pr-4 text-slate-300">
                            {formatPct(fold.inSample.totalReturnPct)}
                          </td>
                          <td className="py-2 pr-4 text-slate-300">
                            {formatPct(fold.outOfSample.totalReturnPct)}
                          </td>
                          <td className="py-2 pr-4 text-slate-400">
                            {formatPct(fold.inSample.maxDrawdownPct)}
                          </td>
                          <td className="py-2 text-slate-400">
                            {formatPct(fold.outOfSample.maxDrawdownPct)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}

          <Card>
            <CardTitle>Equity curve</CardTitle>
            <div className="mt-4 h-72">
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="date" tick={{ fill: "#94a3b8", fontSize: 11 }} />
                    <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{
                        background: "#0f172a",
                        border: "1px solid #334155",
                      }}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="strategy"
                      name="Strategia"
                      stroke="#3b82f6"
                      dot={false}
                      strokeWidth={2}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-sm text-slate-500">Nessun dato equity.</p>
              )}
            </div>
          </Card>

          <Card>
            <CardTitle>Trade simulati</CardTitle>
            {detail.trades.length === 0 ? (
              <p className="mt-3 text-sm text-slate-500">Nessun trade.</p>
            ) : (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-700 text-left text-slate-500">
                      <th className="pb-2 pr-4">Data</th>
                      <th className="pb-2 pr-4">Side</th>
                      <th className="pb-2 pr-4">Qty</th>
                      <th className="pb-2 pr-4">Prezzo</th>
                      <th className="pb-2 pr-4">Fees</th>
                      <th className="pb-2">Motivo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.trades.map((trade) => (
                      <tr key={trade.id} className="border-b border-slate-800">
                        <td className="py-2 pr-4 text-slate-300">
                          {new Date(trade.date).toLocaleDateString("it-IT")}
                        </td>
                        <td className="py-2 pr-4 text-slate-300">{trade.side}</td>
                        <td className="py-2 pr-4 text-slate-400">
                          {trade.quantity.toFixed(6)}
                        </td>
                        <td className="py-2 pr-4 text-slate-400">
                          {formatCurrency(trade.price)}
                        </td>
                        <td className="py-2 pr-4 text-slate-400">
                          {formatCurrency(trade.fees)}
                        </td>
                        <td className="py-2 text-slate-400">{trade.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
