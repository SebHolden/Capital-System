import type { StrategyDefinition } from "./types";

export const buyTheDipStrategy: StrategyDefinition = {
  type: "BUY_THE_DIP",
  defaultConfig: {
    dipPct: 5,
    amountEur: 300,
    lookbackDays: 10,
  },
  generateSignals(context, config) {
    const dipPct = Number(config.dipPct ?? 5);
    const amountEur = Number(config.amountEur ?? 300);
    const lookback = Number(config.lookbackDays ?? 10);
    const signals = [];

    for (let i = lookback; i < context.bars.length; i++) {
      const window = context.bars.slice(i - lookback, i + 1);
      const peak = Math.max(...window.map((b) => b.close));
      const current = context.bars[i];
      if (peak <= 0) continue;

      const drawdownPct = ((current.close - peak) / peak) * 100;
      if (drawdownPct <= -dipPct) {
        signals.push({
          date: current.date,
          side: "BUY" as const,
          amountEur,
          reason: `BUY_THE_DIP ${drawdownPct.toFixed(1)}%`,
        });
      }
    }

    return signals;
  },
};
