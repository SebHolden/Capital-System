import type { BacktestRun } from "@prisma/client";
import type { PerformanceMetrics } from "@/lib/backtesting/types";

export interface BacktestMetricsPayload extends PerformanceMetrics {
  outOfSample?: PerformanceMetrics | null;
  outOfSamplePassed?: boolean;
}

function parseMetricsPayload(run: BacktestRun): BacktestMetricsPayload | null {
  try {
    return JSON.parse(run.metricsJson) as BacktestMetricsPayload;
  } catch {
    return null;
  }
}

export interface BacktestEligibilityResult {
  eligible: boolean;
  reasons: string[];
}

export function getPaperMinBacktestReturnPct(): number {
  const raw = process.env.PAPER_MIN_BACKTEST_RETURN_PCT;
  const parsed = raw ? parseFloat(raw) : 0;
  return Number.isFinite(parsed) ? parsed : 0;
}

export function getPaperMaxBacktestDrawdownPct(): number {
  const raw = process.env.PAPER_MAX_BACKTEST_DRAWDOWN_PCT;
  const parsed = raw ? parseFloat(raw) : 25;
  return Number.isFinite(parsed) ? parsed : 25;
}

export function getPaperPromotionMinSignals(): number {
  const raw = process.env.PAPER_PROMOTION_MIN_SIGNALS;
  const parsed = raw ? parseInt(raw, 10) : 3;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 3;
}

export function getPaperPromotionMinAvg30dPct(): number {
  const raw = process.env.PAPER_PROMOTION_MIN_AVG_30D_PCT;
  const parsed = raw ? parseFloat(raw) : 0;
  return Number.isFinite(parsed) ? parsed : 0;
}

export function getPaperMaxMaePct(): number {
  const raw = process.env.PAPER_MAX_MAE_PCT;
  const parsed = raw ? parseFloat(raw) : 15;
  return Number.isFinite(parsed) ? parsed : 15;
}

export function getPaperPromotionMinRuleFollowedPct(): number {
  const raw = process.env.PAPER_PROMOTION_MIN_RULE_FOLLOWED_PCT;
  const parsed = raw ? parseFloat(raw) : 0;
  return Number.isFinite(parsed) ? parsed : 0;
}

export function checkBacktestEligibility(
  latestRun: BacktestRun | null | undefined,
): BacktestEligibilityResult {
  const reasons: string[] = [];

  if (!latestRun) {
    return {
      eligible: false,
      reasons: ["Nessun backtest completato per questa strategia."],
    };
  }

  if (latestRun.status !== "COMPLETED") {
    return {
      eligible: false,
      reasons: ["L'ultimo backtest non è in stato COMPLETED."],
    };
  }

  const metrics = parseMetricsPayload(latestRun);
  if (!metrics) {
    return {
      eligible: false,
      reasons: ["Metriche backtest non leggibili."],
    };
  }

  const minReturn = getPaperMinBacktestReturnPct();
  if (metrics.totalReturnPct < minReturn) {
    reasons.push(
      `Rendimento backtest ${metrics.totalReturnPct.toFixed(2)}% sotto soglia ${minReturn}%.`,
    );
  }

  const maxDrawdown = getPaperMaxBacktestDrawdownPct();
  if (metrics.maxDrawdownPct > maxDrawdown) {
    reasons.push(
      `Max drawdown ${metrics.maxDrawdownPct.toFixed(2)}% supera soglia ${maxDrawdown}%.`,
    );
  }

  if (!metrics.outOfSample) {
    reasons.push("Test out-of-sample non disponibile (serie troppo corta).");
  } else if (!metrics.outOfSamplePassed) {
    reasons.push(
      `OOS fallito: rendimento ${metrics.outOfSample.totalReturnPct.toFixed(2)}%, drawdown ${metrics.outOfSample.maxDrawdownPct.toFixed(2)}%.`,
    );
  }

  return {
    eligible: reasons.length === 0,
    reasons,
  };
}
