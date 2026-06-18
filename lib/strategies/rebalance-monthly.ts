import type { StrategyDefinition } from "./types";

export interface RebalanceMonthlyConfig {
  targetWeights: Record<string, number>;
}

export const rebalanceMonthlyStrategy: StrategyDefinition = {
  type: "REBALANCE_MONTHLY",
  defaultConfig: {
    targetWeights: {},
  },
  generateSignals(context, config) {
    const rawWeights =
      (config.targetWeights as Record<string, number> | undefined) ?? {};
    const weights = { ...rawWeights };
    if (Object.keys(weights).length === 0) {
      weights[context.assetId] = 1;
    }

    const total = Object.values(weights).reduce((sum, w) => sum + w, 0);
    const normalized: Record<string, number> = {};
    for (const [assetId, weight] of Object.entries(weights)) {
      normalized[assetId] = weight / total;
    }

    const signals = [];
    const seenMonths = new Set<string>();

    for (const bar of context.bars) {
      const monthKey = bar.date.slice(0, 7);
      if (seenMonths.has(monthKey)) continue;
      seenMonths.add(monthKey);

      signals.push({
        date: bar.date,
        side: "HOLD" as const,
        targetWeights: normalized,
        reason: "REBALANCE_MONTHLY",
      });
    }

    return signals;
  },
};
