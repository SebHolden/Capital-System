export interface PeriodLoss {
  pnlAmount: number;
  pnlPct: number;
  lossAmount: number;
  lossPct: number;
}

export function computePeriodLoss(
  baseline: number,
  current: number,
): PeriodLoss {
  const pnlAmount = current - baseline;
  const pnlPct = baseline > 0 ? (pnlAmount / baseline) * 100 : 0;
  const lossAmount = Math.max(0, baseline - current);
  const lossPct = baseline > 0 ? (lossAmount / baseline) * 100 : 0;

  return { pnlAmount, pnlPct, lossAmount, lossPct };
}

export function evaluateLossLimits(input: {
  dailyLossPct: number;
  monthlyLossPct: number;
  maxDailyLossPct: number;
  maxMonthlyLossPct: number;
}): { reasons: string[]; warnings: string[]; blockBuy: boolean } {
  const reasons: string[] = [];
  const warnings: string[] = [];
  let blockBuy = false;

  if (input.dailyLossPct > input.maxDailyLossPct) {
    reasons.push(
      `Perdita giornaliera (${input.dailyLossPct.toFixed(1)}%) supera il limite (${input.maxDailyLossPct}%).`,
    );
    blockBuy = true;
  } else if (input.dailyLossPct > input.maxDailyLossPct * 0.85) {
    warnings.push(
      `Perdita giornaliera (${input.dailyLossPct.toFixed(1)}%) vicina al limite (${input.maxDailyLossPct}%).`,
    );
  }

  if (input.monthlyLossPct > input.maxMonthlyLossPct) {
    reasons.push(
      `Perdita mensile (${input.monthlyLossPct.toFixed(1)}%) supera il limite (${input.maxMonthlyLossPct}%).`,
    );
    blockBuy = true;
  } else if (input.monthlyLossPct > input.maxMonthlyLossPct * 0.85) {
    warnings.push(
      `Perdita mensile (${input.monthlyLossPct.toFixed(1)}%) vicina al limite (${input.maxMonthlyLossPct}%).`,
    );
  }

  return { reasons, warnings, blockBuy };
}

export function lossBudgetRemaining(
  lossPct: number,
  maxLossPct: number,
): number {
  return Math.max(0, maxLossPct - lossPct);
}
