import type { EquityPoint, PerformanceMetrics } from "./types";

function dailyReturns(curve: EquityPoint[]): number[] {
  const returns: number[] = [];
  for (let i = 1; i < curve.length; i++) {
    const prev = curve[i - 1].value;
    const curr = curve[i].value;
    if (prev > 0) returns.push((curr - prev) / prev);
  }
  return returns;
}

function stdDev(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  const variance =
    values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function downsideDeviation(values: number[]): number {
  const negatives = values.filter((v) => v < 0);
  if (negatives.length === 0) return 0;
  const variance =
    negatives.reduce((sum, v) => sum + v ** 2, 0) / negatives.length;
  return Math.sqrt(variance);
}

function monthKey(date: string): string {
  return date.slice(0, 7);
}

export function computeMetrics(
  equityCurve: EquityPoint[],
  initialCapital: number,
  tradeCount: number,
  winningTrades: number,
  avgHoldingDays: number,
): PerformanceMetrics {
  if (equityCurve.length === 0) {
    return {
      totalReturnPct: 0,
      cagrPct: 0,
      volatilityPct: 0,
      maxDrawdownPct: 0,
      sharpeRatio: 0,
      sortinoRatio: 0,
      winRatePct: 0,
      tradeCount,
      avgHoldingDays,
      worstMonthPct: 0,
      bestMonthPct: 0,
      recoveryDays: null,
      finalValue: initialCapital,
    };
  }

  const finalValue = equityCurve[equityCurve.length - 1].value;
  const totalReturnPct =
    initialCapital > 0 ? ((finalValue - initialCapital) / initialCapital) * 100 : 0;

  const startDate = new Date(equityCurve[0].date);
  const endDate = new Date(equityCurve[equityCurve.length - 1].date);
  const years = Math.max(
    (endDate.getTime() - startDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000),
    1 / 365,
  );
  const cagrPct =
    initialCapital > 0
      ? (Math.pow(finalValue / initialCapital, 1 / years) - 1) * 100
      : 0;

  const returns = dailyReturns(equityCurve);
  const volatilityPct = stdDev(returns) * Math.sqrt(252) * 100;
  const annualizedReturn = cagrPct / 100;
  const sharpeRatio =
    volatilityPct > 0
      ? (annualizedReturn - 0.02) / (volatilityPct / 100)
      : 0;
  const sortinoDenom = downsideDeviation(returns) * Math.sqrt(252);
  const sortinoRatio =
    sortinoDenom > 0 ? (annualizedReturn - 0.02) / sortinoDenom : 0;

  let peak = equityCurve[0].value;
  let maxDrawdownPct = 0;
  let troughIndex = 0;
  let peakIndex = 0;
  let maxDdPeakIndex = 0;

  for (let i = 0; i < equityCurve.length; i++) {
    const value = equityCurve[i].value;
    if (value > peak) {
      peak = value;
      peakIndex = i;
    }
    const dd = peak > 0 ? ((peak - value) / peak) * 100 : 0;
    if (dd > maxDrawdownPct) {
      maxDrawdownPct = dd;
      troughIndex = i;
      maxDdPeakIndex = peakIndex;
    }
  }

  let recoveryDays: number | null = null;
  if (maxDrawdownPct > 0) {
    const peakValue = equityCurve[maxDdPeakIndex].value;
    for (let i = troughIndex; i < equityCurve.length; i++) {
      if (equityCurve[i].value >= peakValue) {
        recoveryDays = Math.round(
          (new Date(equityCurve[i].date).getTime() -
            new Date(equityCurve[troughIndex].date).getTime()) /
            (24 * 60 * 60 * 1000),
        );
        break;
      }
    }
  }

  const monthlyReturns = new Map<string, { start: number; end: number }>();
  for (const point of equityCurve) {
    const key = monthKey(point.date);
    const entry = monthlyReturns.get(key);
    if (!entry) {
      monthlyReturns.set(key, { start: point.value, end: point.value });
    } else {
      entry.end = point.value;
    }
  }

  const monthPcts = [...monthlyReturns.values()]
    .filter((m) => m.start > 0)
    .map((m) => ((m.end - m.start) / m.start) * 100);

  const worstMonthPct = monthPcts.length ? Math.min(...monthPcts) : 0;
  const bestMonthPct = monthPcts.length ? Math.max(...monthPcts) : 0;

  return {
    totalReturnPct,
    cagrPct,
    volatilityPct,
    maxDrawdownPct,
    sharpeRatio,
    sortinoRatio,
    winRatePct: tradeCount > 0 ? (winningTrades / tradeCount) * 100 : 0,
    tradeCount,
    avgHoldingDays,
    worstMonthPct,
    bestMonthPct,
    recoveryDays,
    finalValue,
  };
}
