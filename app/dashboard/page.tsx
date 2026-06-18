import Link from "next/link";
import { BucketAllocationChart } from "@/components/dashboard/BucketAllocationChart";
import { PriceStatusBadge } from "@/components/prices/PriceStatusBadge";
import { RefreshPricesButton } from "@/components/prices/RefreshPricesButton";
import { Badge } from "@/components/ui/Badge";
import { Card, CardTitle, CardValue } from "@/components/ui/Card";
import { RiskBadge } from "@/components/ui/RiskBadge";
import { getBucketAllocation, getPortfolioSummary } from "@/lib/portfolio";
import { bucketLabel, formatCurrency, formatPct } from "@/lib/utils";

export default async function DashboardPage() {
  const summary = await getPortfolioSummary();
  const allocation = await getBucketAllocation();

  const {
    portfolio,
    risk,
    riskMetrics,
    tradingWindow,
    stressTest,
    settings,
    priceWarnings,
    journalQuality,
    exposure,
    riskScore,
    operations,
    realizedPnl,
    capitalSplit,
  } = summary;

  const dailyPnl = riskMetrics.daily.pnlAmount;
  const monthlyPnl = riskMetrics.monthly.pnlAmount;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">Dashboard</h2>
          <p className="text-sm text-slate-400">
            Panoramica patrimonio e rischio — capitale ipotetico{" "}
            {formatCurrency(settings.hypotheticalCapital)}. Valori portfolio in
            EUR (crypto CoinGecko EUR; equity Finnhub USD convertiti via FX).
          </p>
        </div>
        <RefreshPricesButton />
      </div>

      {priceWarnings.length > 0 && (
        <div className="rounded-xl border border-amber-800 bg-amber-950/40 p-4">
          <p className="font-semibold text-amber-300">Attenzione prezzi</p>
          <p className="mt-1 text-sm text-amber-400">
            {priceWarnings.length} posizione/i con prezzo stale o mancante. Valori
            basati su fallback (prezzo medio o ultimo snapshot).
          </p>
          <ul className="mt-2 space-y-1 text-sm text-amber-400/90">
            {priceWarnings.map((p) => (
              <li key={p.id} className="flex items-center gap-2">
                <span>{p.asset.symbol}</span>
                <PriceStatusBadge status={p.priceStatus} />
              </li>
            ))}
          </ul>
        </div>
      )}

      {settings.killSwitchActive && (
        <div className="rounded-xl border border-red-800 bg-red-950/50 p-4">
          <p className="font-semibold text-red-300">Kill switch ATTIVO</p>
          <p className="text-sm text-red-400">
            Tutte le operazioni sono bloccate fino alla disattivazione.
          </p>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardTitle>Patrimonio totale</CardTitle>
          <CardValue>{formatCurrency(portfolio.totalValue)}</CardValue>
        </Card>
        <Card>
          <CardTitle>Liquidità</CardTitle>
          <CardValue>{formatCurrency(portfolio.cashBalance)}</CardValue>
          <p className="mt-1 text-xs text-slate-500">
            Sperimentale: {formatCurrency(capitalSplit.experimentalCashBalance)}
          </p>
        </Card>
        <Card>
          <CardTitle>Investito</CardTitle>
          <CardValue>{formatCurrency(portfolio.investedValue)}</CardValue>
        </Card>
        <Card>
          <CardTitle>Rischio complessivo</CardTitle>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <RiskBadge level={risk.level} />
            <span className="text-sm text-slate-400">
              Score {riskScore.score}/100 ({riskScore.label})
            </span>
          </div>
        </Card>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardTitle>Cash ratio</CardTitle>
          <CardValue>{formatPct(exposure.cashRatio)}</CardValue>
        </Card>
        <Card>
          <CardTitle>Invested ratio</CardTitle>
          <CardValue>{formatPct(exposure.investedRatio)}</CardValue>
        </Card>
        <Card>
          <CardTitle>PnL totale</CardTitle>
          <CardValue
            className={
              exposure.lifetimePnl >= 0 ? "text-green-400" : "text-red-400"
            }
          >
            {exposure.lifetimePnl >= 0 ? "+" : ""}
            {formatCurrency(exposure.lifetimePnl)} (
            {formatPct(exposure.lifetimePnlPct)})
          </CardValue>
          <p className="mt-1 text-xs text-slate-500">
            Realizzato: {formatCurrency(realizedPnl.total)}
          </p>
        </Card>
        <Card>
          <CardTitle>Risk score</CardTitle>
          <CardValue>
            {riskScore.score}/100
            <span className="ml-2 text-sm font-normal text-slate-400">
              {riskScore.label}
            </span>
          </CardValue>
        </Card>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardTitle>PnL giornaliero</CardTitle>
          <CardValue className={dailyPnl >= 0 ? "text-green-400" : "text-red-400"}>
            {dailyPnl >= 0 ? "+" : ""}
            {formatCurrency(dailyPnl)} ({formatPct(riskMetrics.daily.pnlPct)})
          </CardValue>
        </Card>
        <Card>
          <CardTitle>PnL mensile</CardTitle>
          <CardValue
            className={monthlyPnl >= 0 ? "text-green-400" : "text-red-400"}
          >
            {monthlyPnl >= 0 ? "+" : ""}
            {formatCurrency(monthlyPnl)} ({formatPct(riskMetrics.monthly.pnlPct)})
          </CardValue>
        </Card>
        <Card>
          <CardTitle>Budget perdita residuo</CardTitle>
          <CardValue className="text-sm leading-relaxed">
            Giorno: {formatPct(riskMetrics.dailyLossBudgetRemainingPct)} /{" "}
            {formatPct(settings.maxDailyLossPct)}
            <br />
            Mese: {formatPct(riskMetrics.monthlyLossBudgetRemainingPct)} /{" "}
            {formatPct(settings.maxMonthlyLossPct)}
          </CardValue>
        </Card>
        <Card>
          <CardTitle>Drawdown</CardTitle>
          <CardValue className="text-sm leading-relaxed">
            {formatPct(riskMetrics.drawdown.drawdownPct)} / max{" "}
            {formatPct(settings.maxDrawdownPct)}
            <br />
            <span className="text-slate-400">
              -{formatCurrency(riskMetrics.drawdown.drawdownAmount)} da picco
            </span>
          </CardValue>
        </Card>
      </div>

      <Card>
        <CardTitle>Finestra trading</CardTitle>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Badge variant={tradingWindow.allowed ? "success" : "danger"}>
            {tradingWindow.allowed ? "Trading consentito" : "Trading bloccato"}
          </Badge>
          {settings.tradingWindowEnabled && (
            <span className="text-sm text-slate-400">
              {settings.tradingStartHour}:00–{settings.tradingEndHour}:00{" "}
              {settings.tradingTimezone} (ora locale: {tradingWindow.currentHour}
              :00)
            </span>
          )}
        </div>
      </Card>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle>Qualità decisionale</CardTitle>
          <Link href="/journal" className="text-sm text-blue-400 hover:underline">
            Vai al journal
          </Link>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg bg-slate-900 p-3 text-sm">
            <p className="text-slate-500">Journal completi</p>
            <p className="text-white">
              {journalQuality.completeCount}/{journalQuality.total} (
              {formatPct(journalQuality.completePct)})
            </p>
          </div>
          <div className="rounded-lg bg-slate-900 p-3 text-sm">
            <p className="text-slate-500">Emotion media (30g)</p>
            <p className="text-white">
              {journalQuality.avgEmotionScore.toFixed(1)}/10
            </p>
          </div>
          <div className="rounded-lg bg-slate-900 p-3 text-sm">
            <p className="text-slate-500">Confidence media (30g)</p>
            <p className="text-white">
              {journalQuality.avgConfidenceScore.toFixed(1)}/10
            </p>
          </div>
          <div className="rounded-lg bg-slate-900 p-3 text-sm">
            <p className="text-slate-500">Trade pianificati (30g)</p>
            <p className="text-white">{formatPct(journalQuality.plannedPct)}</p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2 text-sm">
          <Badge variant="success">GREEN: {journalQuality.levelCounts.GREEN}</Badge>
          <Badge variant="warning">YELLOW: {journalQuality.levelCounts.YELLOW}</Badge>
          <Badge variant="warning">ORANGE: {journalQuality.levelCounts.ORANGE ?? 0}</Badge>
          <Badge variant="danger">RED: {journalQuality.levelCounts.RED}</Badge>
          <Badge variant="muted">
            Senza ordine: {journalQuality.unlinkedCount}
          </Badge>
        </div>
        {journalQuality.recentJournals.length > 0 && (
          <ul className="mt-4 space-y-2">
            {journalQuality.recentJournals.map((j) => (
              <li
                key={j.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-900 px-3 py-2 text-sm"
              >
                <span className="text-slate-300">{j.title}</span>
                <div className="flex items-center gap-2">
                  <RiskBadge level={j.level as import("@prisma/client").RiskLevel} />
                  <span className="text-slate-500">{j.qualityScore}/100</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardTitle>Esposizione per categoria</CardTitle>
          <div className="mt-4 space-y-1">
            {Object.entries(exposure.assetTypePcts).map(([type, pct]) => (
              <div
                key={type}
                className="flex justify-between text-sm text-slate-400"
              >
                <span>{type}</span>
                <span>
                  {formatCurrency(exposure.assetTypeExposure[type] ?? 0)} (
                  {formatPct(pct)})
                </span>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <CardTitle>Top asset per peso</CardTitle>
          <div className="mt-4 space-y-1">
            {exposure.topAssets.map((asset) => (
              <div
                key={asset.symbol}
                className="flex justify-between text-sm text-slate-400"
              >
                <span>
                  {asset.symbol}{" "}
                  <span className="text-slate-600">({asset.assetType})</span>
                </span>
                <span>
                  {formatCurrency(asset.value)} ({formatPct(asset.weightPct)})
                </span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardTitle>Operazioni consentite oggi</CardTitle>
          <ul className="mt-3 list-inside list-disc text-sm text-green-400/90">
            {operations.allowed.map((op) => (
              <li key={op}>{op}</li>
            ))}
            {operations.allowed.length === 0 && (
              <li className="text-slate-500">Nessuna operazione consentita.</li>
            )}
          </ul>
        </Card>
        <Card>
          <CardTitle>Operazioni vietate oggi</CardTitle>
          <ul className="mt-3 list-inside list-disc text-sm text-red-400/90">
            {operations.blocked.map((op) => (
              <li key={op}>{op}</li>
            ))}
            {operations.blocked.length === 0 && (
              <li className="text-slate-500">Nessun blocco attivo.</li>
            )}
          </ul>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardTitle>Allocazione per bucket</CardTitle>
          <div className="mt-4">
            <BucketAllocationChart data={allocation} />
          </div>
          <div className="mt-4 space-y-1">
            {allocation.map((item) => (
              <div
                key={item.bucket}
                className="flex justify-between text-sm text-slate-400"
              >
                <span>{bucketLabel(item.bucket)}</span>
                <span>
                  {formatCurrency(item.value)} ({formatPct(item.pct)})
                </span>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <CardTitle>Stress test</CardTitle>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700 text-left text-slate-500">
                  <th className="pb-2 pr-4">Scenario</th>
                  <th className="pb-2 pr-4">Perdita</th>
                  <th className="pb-2">Valore residuo</th>
                </tr>
              </thead>
              <tbody>
                {stressTest.map((scenario) => (
                  <tr key={scenario.label} className="border-b border-slate-800">
                    <td className="py-2 pr-4 text-slate-300">{scenario.label}</td>
                    <td className="py-2 pr-4 text-red-400">
                      -{formatCurrency(scenario.lossAmount)}
                    </td>
                    <td className="py-2 text-slate-300">
                      {formatCurrency(scenario.portfolioValue)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <Card>
        <CardTitle>Stato sistema</CardTitle>
        <div className="mt-3 flex flex-wrap gap-3">
          <Badge variant={settings.killSwitchActive ? "danger" : "success"}>
            Kill switch: {settings.killSwitchActive ? "ON" : "OFF"}
          </Badge>
          <Badge variant="muted">Execution mode: {settings.executionMode}</Badge>
          <Badge variant="muted">
            Max ordine: {formatCurrency(settings.maxOrderAmount)}
          </Badge>
        </div>
        {risk.reasons.length > 0 && (
          <ul className="mt-4 list-inside list-disc text-sm text-slate-400">
            {risk.reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        )}
        {risk.warnings.length > 0 && (
          <ul className="mt-2 list-inside list-disc text-sm text-amber-400">
            {risk.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
