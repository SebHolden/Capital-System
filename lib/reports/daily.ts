import { getPortfolioSummary } from "@/lib/portfolio";
import { prisma } from "@/lib/db";
import { getUserSettings } from "@/lib/security";
import { listAuditEvents, listOrderActivity } from "./aggregators";
import type { DailyReport } from "./types";
import {
  dayBoundsFromDateKey,
  getDateKeyInTimezone,
} from "./utils";

export async function buildDailyReport(dateKey?: string): Promise<DailyReport> {
  const settings = await getUserSettings();
  const date =
    dateKey ?? getDateKeyInTimezone(settings.tradingTimezone);
  const { since, until } = dayBoundsFromDateKey(date);

  const summary = await getPortfolioSummary();
  const [orders, auditEvents] = await Promise.all([
    listOrderActivity({ since, until }),
    listAuditEvents({ since, until }),
  ]);

  const ordersBlocked = orders.filter((o) => o.riskBlocked).length;
  const ordersExecuted = orders.filter(
    (o) => o.executionStatus === "FILLED",
  ).length;

  const snapshotPayload = {
    bucketPcts: summary.portfolio.bucketPcts,
    cryptoPct: summary.portfolio.cryptoPct,
    killSwitchActive: summary.settings.killSwitchActive,
    executionMode: summary.settings.executionMode,
  };

  await prisma.portfolioSnapshot.upsert({
    where: { snapshotDate: date },
    create: {
      snapshotDate: date,
      totalValue: summary.portfolio.totalValue,
      cashBalance: summary.portfolio.cashBalance,
      investedValue: summary.portfolio.investedValue,
      dailyPnlPct: summary.riskMetrics.daily.pnlPct,
      monthlyPnlPct: summary.riskMetrics.monthly.pnlPct,
      riskLevel: summary.risk.level,
      payloadJson: JSON.stringify(snapshotPayload),
    },
    update: {
      totalValue: summary.portfolio.totalValue,
      cashBalance: summary.portfolio.cashBalance,
      investedValue: summary.portfolio.investedValue,
      dailyPnlPct: summary.riskMetrics.daily.pnlPct,
      monthlyPnlPct: summary.riskMetrics.monthly.pnlPct,
      riskLevel: summary.risk.level,
      payloadJson: JSON.stringify(snapshotPayload),
    },
  });

  return {
    type: "daily",
    date,
    generatedAt: new Date().toISOString(),
    portfolio: {
      totalValue: summary.portfolio.totalValue,
      cashBalance: summary.portfolio.cashBalance,
      investedValue: summary.portfolio.investedValue,
      dailyPnlAmount: summary.riskMetrics.daily.pnlAmount,
      dailyPnlPct: summary.riskMetrics.daily.pnlPct,
      monthlyPnlAmount: summary.riskMetrics.monthly.pnlAmount,
      monthlyPnlPct: summary.riskMetrics.monthly.pnlPct,
      drawdownPct: summary.riskMetrics.drawdown.drawdownPct,
    },
    risk: {
      level: summary.risk.level,
      blocked: summary.risk.blocked,
      reasons: summary.risk.reasons,
      warnings: summary.risk.warnings,
      killSwitchActive: summary.settings.killSwitchActive,
      tradingWindowAllowed: summary.tradingWindow.allowed,
    },
    operations: {
      orders,
      auditEvents,
      ordersBlocked,
      ordersExecuted,
    },
    priceWarnings: summary.priceWarnings.map((p) => ({
      symbol: p.asset.symbol,
      status: p.priceStatus,
    })),
  };
}
