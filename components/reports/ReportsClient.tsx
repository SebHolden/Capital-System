"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { RiskBadge } from "@/components/ui/RiskBadge";
import type {
  DailyReport,
  MonthlyReportData,
  WeeklyReport,
} from "@/lib/reports/types";
import { formatCurrency, formatPct } from "@/lib/utils";

type Tab = "daily" | "weekly" | "monthly";

export function ReportsClient({
  initialDaily,
  initialWeekly,
  initialMonthly,
}: {
  initialDaily: DailyReport;
  initialWeekly: WeeklyReport;
  initialMonthly: MonthlyReportData;
}) {
  const [tab, setTab] = useState<Tab>("daily");
  const [daily, setDaily] = useState(initialDaily);
  const [weekly, setWeekly] = useState(initialWeekly);
  const [monthly, setMonthly] = useState(initialMonthly);
  const [dailyDate, setDailyDate] = useState(initialDaily.date);
  const [weekStart, setWeekStart] = useState(initialWeekly.weekStart);
  const [monthKey, setMonthKey] = useState(initialMonthly.monthKey);
  const [loading, setLoading] = useState(false);

  async function refresh() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (tab === "daily") params.set("date", dailyDate);
      if (tab === "weekly") params.set("start", weekStart);
      if (tab === "monthly") params.set("month", monthKey);

      const endpoint =
        tab === "daily"
          ? "/api/reports/daily"
          : tab === "weekly"
            ? "/api/reports/weekly"
            : "/api/reports/monthly";

      const res = await fetch(`${endpoint}?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(JSON.stringify(data.error ?? data));

      if (tab === "daily") setDaily(data as DailyReport);
      if (tab === "weekly") setWeekly(data as WeeklyReport);
      if (tab === "monthly") setMonthly(data as MonthlyReportData);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Errore caricamento report");
    } finally {
      setLoading(false);
    }
  }

  async function download(format: "json" | "csv") {
    const params = new URLSearchParams({ format });
    if (tab === "daily") params.set("date", dailyDate);
    if (tab === "weekly") params.set("start", weekStart);
    if (tab === "monthly") params.set("month", monthKey);

    const endpoint =
      tab === "daily"
        ? "/api/reports/daily"
        : tab === "weekly"
          ? "/api/reports/weekly"
          : "/api/reports/monthly";

    const res = await fetch(`${endpoint}?${params.toString()}`);
    if (!res.ok) {
      alert("Errore export");
      return;
    }

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `report-${tab}.${format}`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">Report</h2>
        <p className="text-sm text-slate-400">
          Report giornaliero, review settimanale e analisi mensile
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {(
          [
            ["daily", "Giornaliero"],
            ["weekly", "Settimanale"],
            ["monthly", "Mensile"],
          ] as const
        ).map(([id, label]) => (
          <Button
            key={id}
            variant={tab === id ? "primary" : "secondary"}
            onClick={() => setTab(id)}
          >
            {label}
          </Button>
        ))}
      </div>

      <Card>
        <CardTitle>Periodo</CardTitle>
        <div className="mt-4 flex flex-wrap items-end gap-4">
          {tab === "daily" && (
            <div>
              <Label>Data</Label>
              <Input
                type="date"
                value={dailyDate}
                onChange={(e) => setDailyDate(e.target.value)}
              />
            </div>
          )}
          {tab === "weekly" && (
            <div>
              <Label>Inizio settimana</Label>
              <Input
                type="date"
                value={weekStart}
                onChange={(e) => setWeekStart(e.target.value)}
              />
            </div>
          )}
          {tab === "monthly" && (
            <div>
              <Label>Mese</Label>
              <Input
                type="month"
                value={monthKey}
                onChange={(e) => setMonthKey(e.target.value)}
              />
            </div>
          )}
          <Button onClick={refresh} disabled={loading}>
            Aggiorna
          </Button>
          <Button variant="secondary" onClick={() => download("json")}>
            Esporta JSON
          </Button>
          <Button variant="secondary" onClick={() => download("csv")}>
            Esporta CSV
          </Button>
        </div>
      </Card>

      {tab === "daily" && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardTitle>Patrimonio</CardTitle>
              <p className="mt-2 text-xl text-white">
                {formatCurrency(daily.portfolio.totalValue)}
              </p>
            </Card>
            <Card>
              <CardTitle>PnL giorno</CardTitle>
              <p className="mt-2 text-xl text-white">
                {formatCurrency(daily.portfolio.dailyPnlAmount)} (
                {formatPct(daily.portfolio.dailyPnlPct)})
              </p>
            </Card>
            <Card>
              <CardTitle>Rischio</CardTitle>
              <div className="mt-2">
                <RiskBadge level={daily.risk.level} />
              </div>
            </Card>
            <Card>
              <CardTitle>Operazioni</CardTitle>
              <p className="mt-2 text-sm text-slate-300">
                Eseguiti: {daily.operations.ordersExecuted} · Bloccati:{" "}
                {daily.operations.ordersBlocked}
              </p>
            </Card>
          </div>

          {daily.priceWarnings.length > 0 && (
            <Card>
              <CardTitle>Warning prezzi</CardTitle>
              <ul className="mt-2 space-y-1 text-sm text-amber-300">
                {daily.priceWarnings.map((w) => (
                  <li key={w.symbol}>
                    {w.symbol}: {w.status}
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Card>
            <CardTitle>Operazioni del giorno</CardTitle>
            {daily.operations.orders.length === 0 ? (
              <p className="mt-2 text-sm text-slate-400">Nessun ordine.</p>
            ) : (
              <ul className="mt-2 space-y-2 text-sm">
                {daily.operations.orders.map((o) => (
                  <li
                    key={o.id}
                    className="rounded-lg bg-slate-900 p-2 text-slate-300"
                  >
                    {o.side} {o.quantity} {o.symbol} — {o.status}
                    {o.riskBlocked && " (bloccato)"}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      )}

      {tab === "weekly" && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardTitle>Settimana</CardTitle>
              <p className="mt-2 text-sm text-slate-300">
                {weekly.weekStart} → {weekly.weekEnd}
              </p>
            </Card>
            <Card>
              <CardTitle>Performance</CardTitle>
              <p className="mt-2 text-white">
                {weekly.performance.changePct !== null
                  ? formatPct(weekly.performance.changePct)
                  : "—"}
              </p>
              <p className="text-xs text-slate-500">
                Snapshot: {weekly.performance.snapshotCount}
              </p>
            </Card>
            <Card>
              <CardTitle>Journal (periodo)</CardTitle>
              <p className="mt-2 text-sm text-slate-300">
                GREEN {weekly.journalReview.levelCounts.GREEN} · RED{" "}
                {weekly.journalReview.levelCounts.RED}
              </p>
            </Card>
            <Card>
              <CardTitle>Errori decisionali</CardTitle>
              <p className="mt-2 text-sm text-slate-300">
                Ordini bloccati: {weekly.decisionErrors.blockedOrders}
                <br />
                Trade impulsivi:{" "}
                {weekly.decisionErrors.impulsiveTrades.length}
              </p>
            </Card>
          </div>

          {weekly.exposure && (
            <Card>
              <CardTitle>Esposizione (ultimo snapshot)</CardTitle>
              <p className="mt-2 text-sm text-slate-300">
                Crypto: {formatPct(weekly.exposure.cryptoPct)}
              </p>
              <ul className="mt-2 space-y-1 text-sm text-slate-400">
                {Object.entries(weekly.exposure.bucketPcts).map(([b, pct]) => (
                  <li key={b}>
                    {b}: {formatPct(pct)}
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Card>
            <CardTitle>Intent vs outcome</CardTitle>
            {weekly.intentOutcomes.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">
                Nessun ordine eseguito con journal in questa settimana.
              </p>
            ) : (
              <ul className="mt-3 space-y-2 text-sm">
                {weekly.intentOutcomes.map((row) => (
                  <li
                    key={row.orderIntentId}
                    className={`rounded-lg p-3 ${
                      row.withinLossLimit === false
                        ? "bg-red-950/40 text-red-200"
                        : "bg-slate-900/60 text-slate-300"
                    }`}
                  >
                    <p className="font-medium text-white">
                      {row.side} {row.symbol} · {row.journalTitle}
                    </p>
                    <p className="mt-1 text-xs opacity-90">
                      PnL:{" "}
                      {row.pnlAmount !== null
                        ? formatCurrency(row.pnlAmount)
                        : "n/d"}{" "}
                      · Max loss accettabile:{" "}
                      {formatCurrency(row.maxAcceptableLoss)}
                    </p>
                    <p className="mt-1 text-xs opacity-80">{row.note}</p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      )}

      {tab === "monthly" && (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant="warning">
              Decision quality: {monthly.decisionQualityScore}/100
            </Badge>
            <span className="text-sm text-slate-400">Mese {monthly.monthKey}</span>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardTitle>PnL mensile</CardTitle>
              <p className="mt-2 text-white">
                {formatCurrency(monthly.portfolio.monthlyPnlAmount)} (
                {formatPct(monthly.portfolio.monthlyPnlPct)})
              </p>
            </Card>
            <Card>
              <CardTitle>Drawdown</CardTitle>
              <p className="mt-2 text-white">
                {formatPct(monthly.portfolio.drawdownPct)} (
                {formatCurrency(monthly.portfolio.drawdownAmount)})
              </p>
            </Card>
            <Card>
              <CardTitle>vs Benchmark ({monthly.benchmark.symbol})</CardTitle>
              <p className="mt-2 text-white">
                {monthly.benchmark.benchmarkReturnPct !== null
                  ? formatPct(monthly.benchmark.benchmarkReturnPct)
                  : "N/D"}
              </p>
              {monthly.benchmark.outperformancePct !== null && (
                <p className="text-xs text-slate-400">
                  Outperformance:{" "}
                  {formatPct(monthly.benchmark.outperformancePct)}
                </p>
              )}
            </Card>
            <Card>
              <CardTitle>Trade impulsivi</CardTitle>
              <p className="mt-2 text-white">
                {monthly.impulsiveTrades.length}
              </p>
            </Card>
          </div>

          <Card>
            <CardTitle>Strategie migliori</CardTitle>
            {monthly.strategies.best.length === 0 ? (
              <p className="mt-2 text-sm text-slate-400">Nessun dato.</p>
            ) : (
              <ul className="mt-2 space-y-1 text-sm text-slate-300">
                {monthly.strategies.best.map((s) => (
                  <li key={s.strategyId}>
                    {s.strategyName}: {formatPct(s.metric)} ({s.metricLabel})
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardTitle>Strategie peggiori</CardTitle>
            {monthly.strategies.worst.length === 0 ? (
              <p className="mt-2 text-sm text-slate-400">Nessun dato.</p>
            ) : (
              <ul className="mt-2 space-y-1 text-sm text-slate-300">
                {monthly.strategies.worst.map((s) => (
                  <li key={s.strategyId}>
                    {s.strategyName}: {formatPct(s.metric)} ({s.metricLabel})
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
