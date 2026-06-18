import type { StrategyDefinition } from "./types";

function rollingVolatility(bars: { close: number }[], endIdx: number, period: number): number | null {
  if (endIdx < period) return null;
  const returns: number[] = [];
  for (let i = endIdx - period + 1; i <= endIdx; i++) {
    const prev = bars[i - 1]?.close;
    const curr = bars[i]?.close;
    if (!prev || prev <= 0 || !curr) continue;
    returns.push((curr - prev) / prev);
  }
  if (returns.length < 2) return null;
  const mean = returns.reduce((s, r) => s + r, 0) / returns.length;
  const variance =
    returns.reduce((s, r) => s + (r - mean) ** 2, 0) / (returns.length - 1);
  return Math.sqrt(variance) * Math.sqrt(252) * 100;
}

export const volatilityFilterStrategy: StrategyDefinition = {
  type: "VOLATILITY_FILTER",
  defaultConfig: {
    volPeriod: 20,
    maxVolPct: 40,
    amountEur: 250,
  },
  generateSignals(context, config) {
    const period = Number(config.volPeriod ?? 20);
    const maxVol = Number(config.maxVolPct ?? 40);
    const amountEur = Number(config.amountEur ?? 250);
    const signals = [];

    for (let i = period; i < context.bars.length; i++) {
      const vol = rollingVolatility(context.bars, i, period);
      if (vol === null) continue;
      const bar = context.bars[i];

      if (vol <= maxVol) {
        signals.push({
          date: bar.date,
          side: "BUY" as const,
          amountEur,
          reason: `VOL_FILTER vol=${vol.toFixed(1)}%`,
        });
      } else {
        signals.push({
          date: bar.date,
          side: "HOLD" as const,
          reason: `VOL_FILTER alta vol=${vol.toFixed(1)}%`,
        });
      }
    }

    return signals;
  },
};
