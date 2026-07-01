import type { ExecutionMode, RiskLevel } from "@prisma/client";

export type ActionClassification =
  | "DO_NOTHING"
  | "WATCH"
  | "REVIEW_MANUALLY"
  | "PAPER_ONLY"
  | "MANUAL_APPROVAL_REQUIRED";

export interface SuggestedAction {
  id: string;
  title: string;
  description: string;
  classification: ActionClassification;
  riskLevel: RiskLevel;
  strategyName?: string;
  assetSymbol?: string;
  maxAmountEur?: number;
  reason: string;
}

export interface SafetyNotice {
  liveTradingDisabled: boolean;
  executionMode: ExecutionMode;
  messages: string[];
}

export interface DailyWorkflowResult {
  prices: { refreshed: number; failed: number };
  paperSignals: {
    created: number;
    skipped: number;
    metricsUpdated: number;
    promoted: string[];
    degraded: string[];
    evaluationsSynced: number;
  };
}

export interface DailyDecisionBrief {
  date: string;
  generatedAt: string;

  portfolio: {
    totalValue: number;
    dailyPnlPct: number;
    monthlyPnlPct: number;
    drawdownPct: number;
  };

  riskStatus: {
    level: RiskLevel;
    killSwitchActive: boolean;
    tradingWindowAllowed: boolean;
    reasons: string[];
    warnings: string[];
  };

  paperSignals: {
    newToday: number;
    closedToday: number;
    openTotal: number;
  };

  strategies: {
    bestByScore: { name: string; score: number; rating: string } | null;
    worstByScore: { name: string; score: number; rating: string } | null;
    promotedToday: string[];
    degradedToday: string[];
  };

  whatHappened: string[];
  whatRequiresAttention: string[];
  whatNotToDo: string[];
  warnings: string[];
  doNothingReason: string | null;

  actions: SuggestedAction[];

  systemStatus: {
    executionMode: ExecutionMode;
    liveTradingEnabled: boolean;
    killSwitchActive: boolean;
    lastWorkflowAt: string | null;
  };

  safetyNotice: SafetyNotice;

  workflow?: DailyWorkflowResult;
}

export const SAFETY_MESSAGES = [
  "Live trading is disabled (ENABLE_LIVE_TRADING=false)",
  "No autonomous real-money execution",
  "Paper signals are NOT orders — they are analytical only",
  "Promoted strategy does NOT mean live execution allowed",
  "All suggested actions require manual review",
] as const;
