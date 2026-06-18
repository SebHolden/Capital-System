import type { StrategyType } from "@prisma/client";
import type { PriceBar } from "@/lib/prices/history";

export type SignalSide = "BUY" | "SELL" | "HOLD";

export interface StrategySignal {
  date: string;
  side: SignalSide;
  amountEur?: number;
  targetWeights?: Record<string, number>;
  reason: string;
}

export interface StrategyContext {
  bars: PriceBar[];
  assetId: string;
  assetSymbol: string;
  initialCapital: number;
  extraBarsByAssetId?: Map<string, PriceBar[]>;
}

export interface StrategyDefinition {
  type: StrategyType;
  defaultConfig: Record<string, unknown>;
  generateSignals: (
    context: StrategyContext,
    config: Record<string, unknown>,
  ) => StrategySignal[];
}
