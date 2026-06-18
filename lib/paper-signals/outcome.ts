import type {
  PaperSignalOutcome,
  PaperSignalStatus,
  PaperSignalType,
} from "@prisma/client";

export interface OutcomeThresholds {
  winThresholdPct: number;
  lossThresholdPct: number;
  minBarsFor30d: number;
}

export function getPaperWinThresholdPct(): number {
  const raw = process.env.PAPER_WIN_THRESHOLD_PCT;
  const parsed = raw ? parseFloat(raw) : 2;
  return Number.isFinite(parsed) ? parsed : 2;
}

export function getPaperLossThresholdPct(): number {
  const raw = process.env.PAPER_LOSS_THRESHOLD_PCT;
  const parsed = raw ? parseFloat(raw) : -2;
  return Number.isFinite(parsed) ? parsed : -2;
}

export function getPaperMinBarsFor30d(): number {
  const raw = process.env.PAPER_MIN_BARS_FOR_30D;
  const parsed = raw ? parseInt(raw, 10) : 25;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 25;
}

export function defaultOutcomeThresholds(): OutcomeThresholds {
  return {
    winThresholdPct: getPaperWinThresholdPct(),
    lossThresholdPct: getPaperLossThresholdPct(),
    minBarsFor30d: getPaperMinBarsFor30d(),
  };
}

/**
 * Classifies paper signal outcome from horizon returns.
 * For BUY/REBALANCE/HOLD and SELL, result30dPct is already side-adjusted
 * via resultPctForSide (SELL profits when price falls).
 */
export function classifyOutcome(input: {
  signalType: PaperSignalType;
  result30dPct: number | null;
  result7dPct: number | null;
  status: PaperSignalStatus;
  barsAfterSignal: number;
  thresholds?: OutcomeThresholds;
}): PaperSignalOutcome {
  const thresholds = input.thresholds ?? defaultOutcomeThresholds();
  const { result30dPct, status, barsAfterSignal } = input;

  if (status === "EXPIRED" && result30dPct === null) {
    return "EXPIRED";
  }

  if (result30dPct === null) {
    if (barsAfterSignal < thresholds.minBarsFor30d) {
      return "INSUFFICIENT_DATA";
    }
    return "PENDING";
  }

  if (result30dPct >= thresholds.winThresholdPct) {
    return "WIN";
  }

  if (result30dPct <= thresholds.lossThresholdPct) {
    return "LOSS";
  }

  return "FLAT";
}

export function isEvaluatedOutcome(outcome: PaperSignalOutcome): boolean {
  return (
    outcome === "WIN" ||
    outcome === "LOSS" ||
    outcome === "FLAT" ||
    outcome === "EXPIRED" ||
    outcome === "INSUFFICIENT_DATA"
  );
}
