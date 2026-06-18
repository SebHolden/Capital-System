import type { JournalQualitySummary } from "@/lib/journal";

export interface ReportOrderActivity {
  id: string;
  symbol: string;
  side: string;
  quantity: number;
  status: string;
  executionMode: string | null;
  riskLevel: string | null;
  riskBlocked: boolean;
  executionStatus: string | null;
  fillPrice: number | null;
  journalTitle: string | null;
  createdAt: string;
}

export interface ReportAuditEvent {
  id: string;
  action: string;
  entity: string;
  entityId: string | null;
  createdAt: string;
}

export interface ImpulsiveTrade {
  orderIntentId: string;
  symbol: string;
  side: string;
  quantity: number;
  fillPrice: number | null;
  journalTitle: string | null;
  emotionScore: number | null;
  planned: boolean | null;
  journalLevel: string;
  reason: string;
  executedAt: string;
}

export interface DailyReport {
  type: "daily";
  date: string;
  generatedAt: string;
  portfolio: {
    totalValue: number;
    cashBalance: number;
    investedValue: number;
    dailyPnlAmount: number;
    dailyPnlPct: number;
    monthlyPnlAmount: number;
    monthlyPnlPct: number;
    drawdownPct: number;
  };
  risk: {
    level: string;
    blocked: boolean;
    reasons: string[];
    warnings: string[];
    killSwitchActive: boolean;
    tradingWindowAllowed: boolean;
  };
  operations: {
    orders: ReportOrderActivity[];
    auditEvents: ReportAuditEvent[];
    ordersBlocked: number;
    ordersExecuted: number;
  };
  priceWarnings: Array<{ symbol: string; status: string }>;
}

export interface WeeklyReport {
  type: "weekly";
  weekStart: string;
  weekEnd: string;
  generatedAt: string;
  performance: {
    snapshotCount: number;
    startValue: number | null;
    endValue: number | null;
    changePct: number | null;
    minValue: number | null;
    maxValue: number | null;
  };
  journalReview: JournalQualitySummary;
  decisionErrors: {
    blockedOrders: number;
    redJournals: number;
    impulsiveTrades: ImpulsiveTrade[];
  };
  exposure: {
    bucketPcts: Record<string, number>;
    cryptoPct: number;
  } | null;
}

export interface StrategyPerformanceRow {
  strategyId: string;
  strategyName: string;
  status: string;
  metric: number;
  metricLabel: string;
}

export interface MonthlyReportData {
  type: "monthly";
  monthKey: string;
  generatedAt: string;
  decisionQualityScore: number;
  portfolio: {
    totalValue: number;
    monthlyPnlAmount: number;
    monthlyPnlPct: number;
    drawdownPct: number;
    drawdownAmount: number;
  };
  benchmark: {
    symbol: string;
    benchmarkReturnPct: number | null;
    portfolioReturnPct: number;
    outperformancePct: number | null;
    warning?: string;
  };
  strategies: {
    best: StrategyPerformanceRow[];
    worst: StrategyPerformanceRow[];
  };
  impulsiveTrades: ImpulsiveTrade[];
  journalQuality: JournalQualitySummary;
  persistedReportId?: string;
}

export type AnyReport = DailyReport | WeeklyReport | MonthlyReportData;
