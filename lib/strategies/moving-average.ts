import type { StrategyDefinition } from "./types";

export interface MovingAverageConfig {
  fastPeriod: number;
  slowPeriod: number;
  positionPct: number;
}

function sma(values: number[], period: number, index: number): number | null {
  if (index + 1 < period) return null;
  const slice = values.slice(index + 1 - period, index + 1);
  return slice.reduce((sum, v) => sum + v, 0) / period;
}

export const movingAverageStrategy: StrategyDefinition = {
  type: "MOVING_AVERAGE_CROSS",
  defaultConfig: {
    fastPeriod: 20,
    slowPeriod: 50,
    positionPct: 0.95,
  },
  generateSignals(context, config) {
    const fastPeriod = Number(config.fastPeriod ?? 20);
    const slowPeriod = Number(config.slowPeriod ?? 50);
    const positionPct = Number(config.positionPct ?? 0.95);

    const closes = context.bars.map((b) => b.close);
    const signals = [];
    let inPosition = false;

    for (let i = 0; i < context.bars.length; i++) {
      const fast = sma(closes, fastPeriod, i);
      const slow = sma(closes, slowPeriod, i);
      if (fast === null || slow === null) continue;

      const bar = context.bars[i];
      const prevFast =
        i > 0 ? sma(closes, fastPeriod, i - 1) : null;
      const prevSlow =
        i > 0 ? sma(closes, slowPeriod, i - 1) : null;

      if (prevFast === null || prevSlow === null) continue;

      const crossUp = prevFast <= prevSlow && fast > slow;
      const crossDown = prevFast >= prevSlow && fast < slow;

      if (crossUp && !inPosition) {
        inPosition = true;
        signals.push({
          date: bar.date,
          side: "BUY" as const,
          amountEur: context.initialCapital * positionPct,
          reason: `MA_CROSS_BUY_${fastPeriod}_${slowPeriod}`,
        });
      } else if (crossDown && inPosition) {
        inPosition = false;
        signals.push({
          date: bar.date,
          side: "SELL" as const,
          reason: `MA_CROSS_SELL_${fastPeriod}_${slowPeriod}`,
        });
      }
    }

    return signals;
  },
};
