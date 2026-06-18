import type { StrategyDefinition } from "./types";

export const coreSatelliteStrategy: StrategyDefinition = {
  type: "CORE_SATELLITE",
  defaultConfig: {
    coreWeight: 0.7,
    satelliteWeight: 0.3,
    rebalanceMonthDay: 1,
    coreAmountEur: 400,
    satelliteAmountEur: 150,
  },
  generateSignals(context, config) {
    const coreAmount = Number(config.coreAmountEur ?? 400);
    const satelliteAmount = Number(config.satelliteAmountEur ?? 150);
    const seenMonths = new Set<string>();
    const signals = [];

    for (const bar of context.bars) {
      const monthKey = bar.date.slice(0, 7);
      if (seenMonths.has(monthKey)) continue;
      seenMonths.add(monthKey);

      signals.push({
        date: bar.date,
        side: "BUY" as const,
        amountEur: coreAmount,
        reason: "CORE_SATELLITE core",
      });
      signals.push({
        date: bar.date,
        side: "BUY" as const,
        amountEur: satelliteAmount,
        reason: "CORE_SATELLITE satellite",
      });
    }

    return signals;
  },
};
