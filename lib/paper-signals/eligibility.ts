import type { BacktestRun, Strategy } from "@prisma/client";
import type { PerformanceMetrics } from "@/lib/backtesting/types";

export interface BacktestMetricsPayload extends PerformanceMetrics {
  outOfSample?: PerformanceMetrics | null;
  outOfSamplePassed?: boolean;
}

export interface WalkForwardEligibilityResult {
  eligible: boolean;
  reasons: string[];
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

export function getPaperPromotionMinWinRatePct(): number {
  const raw = process.env.PAPER_PROMOTION_MIN_WIN_RATE_PCT;
  const parsed = raw ? parseFloat(raw) : 40;
  return Number.isFinite(parsed) ? parsed : 40;
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

export function getWalkForwardMinScoreForPaper(): number {
  const raw = process.env.WALKFORWARD_MIN_SCORE_FOR_PAPER;
  const parsed = raw ? parseFloat(raw) : 0.5;
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 1 ? parsed : 0.5;
}

export function getMaxOverfitScoreForPaper(): number {
  const raw = process.env.MAX_OVERFIT_SCORE_FOR_PAPER;
  const parsed = raw ? parseFloat(raw) : 0.6;
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 1 ? parsed : 0.6;
}

export function getMinDataQualityForPaper(): number {
  const raw = process.env.MIN_DATA_QUALITY_FOR_PAPER;
  const parsed = raw ? parseInt(raw, 10) : 50;
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 100 ? parsed : 50;
}

export function isWalkForwardRequired(): boolean {
  const raw = process.env.WALKFORWARD_REQUIRED_FOR_PAPER;
  return raw !== "false";
}

export function checkWalkForwardEligibility(
  strategy: Pick<
    Strategy,
    "walkForwardValidatedAt" | "walkForwardScore" | "overfitScore" | "dataQualityAvgScore"
  >,
): WalkForwardEligibilityResult {
  const reasons: string[] = [];

  if (!isWalkForwardRequired()) {
    return { eligible: true, reasons: [] };
  }

  if (!strategy.walkForwardValidatedAt) {
    return {
      eligible: false,
      reasons: ["Walk-forward validation non ancora eseguita."],
    };
  }

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  if (strategy.walkForwardValidatedAt < thirtyDaysAgo) {
    reasons.push("Walk-forward validation scaduta (>30 giorni).");
  }

  const minWfScore = getWalkForwardMinScoreForPaper();
  if (
    strategy.walkForwardScore === null ||
    strategy.walkForwardScore < minWfScore
  ) {
    reasons.push(
      `Walk-forward score ${((strategy.walkForwardScore ?? 0) * 100).toFixed(0)}% sotto soglia ${(minWfScore * 100).toFixed(0)}%.`,
    );
  }

  const maxOverfit = getMaxOverfitScoreForPaper();
  if (strategy.overfitScore !== null && strategy.overfitScore > maxOverfit) {
    reasons.push(
      `Overfit score ${(strategy.overfitScore * 100).toFixed(0)}% sopra soglia ${(maxOverfit * 100).toFixed(0)}%.`,
    );
  }

  const minDataQuality = getMinDataQualityForPaper();
  if (
    strategy.dataQualityAvgScore !== null &&
    strategy.dataQualityAvgScore < minDataQuality
  ) {
    reasons.push(
      `Data quality ${strategy.dataQualityAvgScore}/100 sotto soglia ${minDataQuality}/100.`,
    );
  }

  return {
    eligible: reasons.length === 0,
    reasons,
  };
}

export interface FullPaperEligibilityResult {
  eligible: boolean;
  backtestReasons: string[];
  walkForwardReasons: string[];
}

export function checkFullPaperEligibility(
  latestRun: BacktestRun | null | undefined,
  strategy: Pick<
    Strategy,
    "walkForwardValidatedAt" | "walkForwardScore" | "overfitScore" | "dataQualityAvgScore"
  >,
): FullPaperEligibilityResult {
  const backtestResult = checkBacktestEligibility(latestRun);
  const wfResult = checkWalkForwardEligibility(strategy);

  return {
    eligible: backtestResult.eligible && wfResult.eligible,
    backtestReasons: backtestResult.reasons,
    walkForwardReasons: wfResult.reasons,
  };
}
