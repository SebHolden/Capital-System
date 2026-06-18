import type { StrategyDefinition } from "./types";

export interface DcaMonthlyConfig {
  monthlyAmountEur: number;
}

export const dcaMonthlyStrategy: StrategyDefinition = {
  type: "DCA_MONTHLY",
  defaultConfig: {
    monthlyAmountEur: 250,
  },
  generateSignals(context, config) {
    const monthlyAmountEur = Number(config.monthlyAmountEur ?? 250);
    const signals = [];
    const seenMonths = new Set<string>();

    for (const bar of context.bars) {
      const monthKey = bar.date.slice(0, 7);
      if (seenMonths.has(monthKey)) continue;
      seenMonths.add(monthKey);

      signals.push({
        date: bar.date,
        side: "BUY" as const,
        amountEur: monthlyAmountEur,
        reason: "DCA_MONTHLY",
      });
    }

    return signals;
  },
};
