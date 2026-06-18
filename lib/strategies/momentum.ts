import type { StrategyDefinition } from "./types";

export const momentumStrategy: StrategyDefinition = {
  type: "MOMENTUM",
  defaultConfig: {
    lookbackDays: 20,
    positionPct: 0.5,
  },
  generateSignals(context, config) {
    const lookback = Number(config.lookbackDays ?? 20);
    const signals = [];

    for (let i = lookback; i < context.bars.length; i++) {
      const current = context.bars[i];
      const past = context.bars[i - lookback];
      if (past.close <= 0) continue;

      const momentumPct = ((current.close - past.close) / past.close) * 100;
      if (momentumPct > 2) {
        signals.push({
          date: current.date,
          side: "BUY" as const,
          amountEur: context.initialCapital * Number(config.positionPct ?? 0.5) * 0.1,
          reason: `MOMENTUM +${momentumPct.toFixed(1)}%`,
        });
      } else if (momentumPct < -2) {
        signals.push({
          date: current.date,
          side: "SELL" as const,
          reason: `MOMENTUM ${momentumPct.toFixed(1)}%`,
        });
      }
    }

    return signals;
  },
};
