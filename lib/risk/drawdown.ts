export interface DrawdownMetrics {
  drawdownPct: number;
  drawdownAmount: number;
  peakValue: number;
}

export function computeDrawdown(
  peakValue: number,
  currentValue: number,
): DrawdownMetrics {
  if (peakValue <= 0) {
    return { drawdownPct: 0, drawdownAmount: 0, peakValue };
  }

  const drawdownAmount = Math.max(0, peakValue - currentValue);
  const drawdownPct = (drawdownAmount / peakValue) * 100;

  return { drawdownPct, drawdownAmount, peakValue };
}

export function evaluateDrawdown(input: {
  drawdownPct: number;
  maxDrawdownPct: number;
}): { reasons: string[]; warnings: string[]; blockBuy: boolean } {
  const reasons: string[] = [];
  const warnings: string[] = [];

  if (input.drawdownPct > input.maxDrawdownPct) {
    reasons.push(
      `Drawdown corrente (${input.drawdownPct.toFixed(1)}%) supera il limite (${input.maxDrawdownPct}%).`,
    );
    return { reasons, warnings, blockBuy: true };
  }

  if (input.drawdownPct > input.maxDrawdownPct * 0.85) {
    warnings.push(
      `Drawdown (${input.drawdownPct.toFixed(1)}%) vicino al limite (${input.maxDrawdownPct}%).`,
    );
  }

  return { reasons, warnings, blockBuy: false };
}
