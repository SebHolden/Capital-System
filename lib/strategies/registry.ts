import type { StrategyType } from "@prisma/client";
import { buyTheDipStrategy } from "./buy-the-dip";
import { coreSatelliteStrategy } from "./core-satellite";
import { dcaMonthlyStrategy } from "./dca-monthly";
import { momentumStrategy } from "./momentum";
import { movingAverageStrategy } from "./moving-average";
import { rebalanceMonthlyStrategy } from "./rebalance-monthly";
import { volatilityFilterStrategy } from "./volatility-filter";
import type { StrategyDefinition } from "./types";

export function getStrategyDefinition(type: StrategyType): StrategyDefinition {
  switch (type) {
    case "DCA_MONTHLY":
      return dcaMonthlyStrategy;
    case "REBALANCE_MONTHLY":
      return rebalanceMonthlyStrategy;
    case "MOVING_AVERAGE_CROSS":
      return movingAverageStrategy;
    case "MOMENTUM":
      return momentumStrategy;
    case "BUY_THE_DIP":
      return buyTheDipStrategy;
    case "VOLATILITY_FILTER":
      return volatilityFilterStrategy;
    case "CORE_SATELLITE":
      return coreSatelliteStrategy;
  }
}

export function getDefaultStrategyConfig(
  type: StrategyType,
): Record<string, unknown> {
  return { ...getStrategyDefinition(type).defaultConfig };
}

export function getStrategyDisplayName(type: StrategyType): string {
  switch (type) {
    case "DCA_MONTHLY":
      return "DCA mensile";
    case "REBALANCE_MONTHLY":
      return "Ribilanciamento mensile";
    case "MOVING_AVERAGE_CROSS":
      return "Moving average cross";
    case "MOMENTUM":
      return "Momentum";
    case "BUY_THE_DIP":
      return "Buy the dip";
    case "VOLATILITY_FILTER":
      return "Volatility filter";
    case "CORE_SATELLITE":
      return "Core satellite";
  }
}
