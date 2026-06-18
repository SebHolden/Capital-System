import { prisma } from "@/lib/db";
import { getJournalQualitySummary } from "@/lib/journal";
import { getPortfolioSummary } from "@/lib/portfolio";
import { fetchPriceHistory } from "@/lib/prices/history";
import { getPaperStrategyRankings } from "@/lib/paper-signals";
import { getUserSettings } from "@/lib/security";
import { findImpulsiveTrades } from "./aggregators";
import { computeDecisionQualityScore } from "./decisionQuality";
import type { MonthlyReportData, StrategyPerformanceRow } from "./types";
import { getMonthKeyInTimezone, monthBoundsFromKey } from "./utils";

async function computeMonthlyBenchmark(
  portfolioReturnPct: number,
  monthKey: string,
): Promise<MonthlyReportData["benchmark"]> {
  const symbol = process.env.REPORTS_BENCHMARK_SYMBOL?.trim() || "BTC";
  const asset = await prisma.asset.findFirst({
    where: { symbol },
  });

  if (!asset) {
    return {
      symbol,
      benchmarkReturnPct: null,
      portfolioReturnPct,
      outperformancePct: null,
      warning: `Asset benchmark ${symbol} non trovato.`,
    };
  }

  const { since, until } = monthBoundsFromKey(monthKey);

  try {
    const { bars, warning } = await fetchPriceHistory(asset, since, until);
    if (bars.length < 2) {
      return {
        symbol,
        benchmarkReturnPct: null,
        portfolioReturnPct,
        outperformancePct: null,
        warning: warning ?? "Dati benchmark insufficienti.",
      };
    }
    const startPrice = bars[0].close;
    const endPrice = bars[bars.length - 1].close;
    const benchmarkReturnPct =
      startPrice > 0 ? ((endPrice - startPrice) / startPrice) * 100 : 0;

    return {
      symbol,
      benchmarkReturnPct,
      portfolioReturnPct,
      outperformancePct: portfolioReturnPct - benchmarkReturnPct,
      warning,
    };
  } catch (error) {
    return {
      symbol,
      benchmarkReturnPct: null,
      portfolioReturnPct,
      outperformancePct: null,
      warning:
        error instanceof Error ? error.message : "Errore benchmark mensile.",
    };
  }
}

async function loadStrategyPerformance(): Promise<{
  best: StrategyPerformanceRow[];
  worst: StrategyPerformanceRow[];
}> {
  const rankings = await getPaperStrategyRankings();

  if (rankings.length >= 2) {
    const rows: StrategyPerformanceRow[] = rankings.map((r) => ({
      strategyId: r.strategyId,
      strategyName: r.strategyName,
      status: r.status,
      metric: r.avg30dPct ?? 0,
      metricLabel: "avg30dPct",
      signalCount: r.signalCount,
      avg30dPct: r.avg30dPct,
      ruleFollowedPct: r.ruleFollowedPct,
    }));

    return {
      best: rows.slice(0, 3),
      worst: [...rows].reverse().slice(0, 3),
    };
  }

  const runs = await prisma.backtestRun.findMany({
    where: { status: "COMPLETED" },
    include: { strategy: { select: { id: true, name: true, status: true } } },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  const fromBacktests: StrategyPerformanceRow[] = [];
  for (const run of runs) {
    try {
      const metrics = JSON.parse(run.metricsJson) as { totalReturnPct?: number };
      fromBacktests.push({
        strategyId: run.strategyId,
        strategyName: run.strategy.name,
        status: run.strategy.status,
        metric: metrics.totalReturnPct ?? 0,
        metricLabel: "backtestReturnPct",
        signalCount: 0,
        avg30dPct: null,
        ruleFollowedPct: null,
      });
    } catch {
      // skip invalid metrics
    }
  }
  fromBacktests.sort((a, b) => b.metric - a.metric);

  return {
    best: fromBacktests.slice(0, 3),
    worst: [...fromBacktests].reverse().slice(0, 3),
  };
}

export async function buildMonthlyReport(
  monthKey?: string,
): Promise<MonthlyReportData> {
  const settings = await getUserSettings();
  const month = monthKey ?? getMonthKeyInTimezone(settings.tradingTimezone);
  const { since, until } = monthBoundsFromKey(month);

  const [summary, journalQuality, impulsiveTrades, strategies] =
    await Promise.all([
      getPortfolioSummary(),
      getJournalQualitySummary(prisma, { since, until }),
      findImpulsiveTrades({ since, until }),
      loadStrategyPerformance(),
    ]);

  const benchmark = await computeMonthlyBenchmark(
    summary.riskMetrics.monthly.pnlPct,
    month,
  );

  const decisionQualityScore = computeDecisionQualityScore(journalQuality);

  const reportBody: Omit<MonthlyReportData, "persistedReportId"> = {
    type: "monthly",
    monthKey: month,
    generatedAt: new Date().toISOString(),
    decisionQualityScore,
    portfolio: {
      totalValue: summary.portfolio.totalValue,
      monthlyPnlAmount: summary.riskMetrics.monthly.pnlAmount,
      monthlyPnlPct: summary.riskMetrics.monthly.pnlPct,
      drawdownPct: summary.riskMetrics.drawdown.drawdownPct,
      drawdownAmount: summary.riskMetrics.drawdown.drawdownAmount,
    },
    benchmark,
    strategies,
    impulsiveTrades,
    journalQuality,
  };

  const persisted = await prisma.monthlyReport.upsert({
    where: { monthKey: month },
    create: {
      monthKey: month,
      decisionQualityScore,
      payloadJson: JSON.stringify(reportBody),
    },
    update: {
      decisionQualityScore,
      payloadJson: JSON.stringify(reportBody),
      generatedAt: new Date(),
    },
  });

  return {
    ...reportBody,
    persistedReportId: persisted.id,
  };
}
