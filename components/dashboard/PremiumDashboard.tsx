"use client";

import { GlassCard, GlassCardTitle, GlassCardValue } from "@/components/ui/GlassCard";
import { DonutChart, DonutLegend } from "./DonutChart";
import { RiskGauge, MiniGauge } from "./RiskGauge";
import { StressTest } from "./StressTest";
import { StatusBar } from "./StatusBar";
import { formatCurrency, formatPct } from "@/lib/utils";

interface PremiumDashboardProps {
  portfolio: {
    totalValue: number;
    cashBalance: number;
    investedValue: number;
  };
  exposure: {
    cashRatio: number;
    investedRatio: number;
    lifetimePnl: number;
    lifetimePnlPct: number;
  };
  riskScore: {
    score: number;
    label: string;
  };
  riskMetrics: {
    daily: {
      pnlAmount: number;
      pnlPct: number;
    };
  };
  allocation: Array<{
    bucket: string;
    value: number;
    pct: number;
  }>;
  stressTest: Array<{
    label: string;
    drawdownPct: number;
    lossAmount: number;
    portfolioValue: number;
  }>;
  settings: {
    killSwitchActive: boolean;
    executionMode: string;
    hypotheticalCapital: number;
  };
}

export function PremiumDashboard({
  portfolio,
  exposure,
  riskScore,
  riskMetrics,
  allocation,
  stressTest,
  settings,
}: PremiumDashboardProps) {
  const pnlPositive = exposure.lifetimePnl >= 0;
  const dailyPnlPositive = riskMetrics.daily.pnlAmount >= 0;

  return (
    <>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white">
          Seb Capital
          <br />
          <span className="text-gradient">Premium Dashboard</span>
        </h1>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div className="grid gap-4 sm:grid-cols-2">
            <GlassCard gradient="success" className="relative overflow-hidden">
              <GlassCardTitle>TOTAL EQUITY</GlassCardTitle>
              <GlassCardValue size="xl" className="text-white">
                {formatCurrency(portfolio.totalValue)}
              </GlassCardValue>
              <div className="mt-2 flex items-center gap-1 text-sm">
                <span className="text-green-400">↗</span>
                <span className="text-green-400">
                  {pnlPositive ? "+" : ""}
                  {formatPct(exposure.lifetimePnlPct)}
                </span>
              </div>
            </GlassCard>

            <GlassCard gradient={pnlPositive ? "success" : "danger"}>
              <GlassCardTitle>NET PnL</GlassCardTitle>
              <GlassCardValue
                size="xl"
                className={pnlPositive ? "text-green-400" : "text-red-400"}
              >
                {pnlPositive ? "+ " : ""}
                {formatCurrency(exposure.lifetimePnl)}
              </GlassCardValue>
              <div className="mt-2 flex items-center gap-1 text-sm">
                <span className={pnlPositive ? "text-green-400" : "text-red-400"}>
                  ({pnlPositive ? "+" : ""}
                  {formatPct(exposure.lifetimePnlPct)})
                </span>
                <span className={pnlPositive ? "text-green-400" : "text-red-400"}>
                  ↗
                </span>
              </div>
            </GlassCard>
          </div>

          <GlassCard>
            <GlassCardTitle>BUCKET ALLOCATION</GlassCardTitle>
            <DonutChart
              data={allocation}
              centerValue={portfolio.totalValue}
              centerLabel="TOTAL"
            />
            <DonutLegend data={allocation} />
          </GlassCard>

          <div className="grid gap-4 sm:grid-cols-4">
            <MiniGauge
              label="Cash Ratio"
              value={formatPct(exposure.cashRatio)}
              color="accent"
            />
            <MiniGauge
              label="Invested Ratio"
              value={formatPct(exposure.investedRatio)}
              color="success"
            />
            <GlassCard className="text-center">
              <p className="text-xs font-medium text-slate-400">Risk Score</p>
              <p className="mt-1 text-xl font-bold text-blue-400">
                {riskScore.score}/100
              </p>
              <p className="text-xs text-slate-500">({riskScore.label})</p>
            </GlassCard>
            <GlassCard
              className="text-center"
              gradient={dailyPnlPositive ? "success" : "danger"}
            >
              <p className="text-xs font-medium text-slate-400">Daily PnL</p>
              <p
                className={`mt-1 text-xl font-bold ${dailyPnlPositive ? "text-green-400" : "text-red-400"}`}
              >
                {dailyPnlPositive ? "+" : ""}
                {formatCurrency(riskMetrics.daily.pnlAmount)}
              </p>
              <p className="text-xs text-slate-500">
                ({dailyPnlPositive ? "+" : ""}
                {formatPct(riskMetrics.daily.pnlPct)})
              </p>
            </GlassCard>
          </div>
        </div>

        <div className="space-y-6">
          <GlassCard>
            <GlassCardTitle>RISK ANALYSIS</GlassCardTitle>

            <div className="mt-4">
              <h4 className="mb-3 text-sm font-medium text-slate-300">STRESS TEST</h4>
              <StressTest scenarios={stressTest} />
            </div>

            <div className="mt-6 border-t border-slate-700/50 pt-6">
              <h4 className="mb-4 text-center text-sm font-medium text-slate-300">
                RISK SCORE
              </h4>
              <div className="flex justify-center">
                <RiskGauge value={riskScore.score} size="lg" />
              </div>
            </div>
          </GlassCard>
        </div>
      </div>

      <StatusBar
        killSwitchActive={settings.killSwitchActive}
        executionMode={settings.executionMode}
      />
    </>
  );
}
