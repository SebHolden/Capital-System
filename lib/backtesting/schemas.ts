import { z } from "zod";

const strategyTypeEnum = z.enum([
  "DCA_MONTHLY",
  "REBALANCE_MONTHLY",
  "MOVING_AVERAGE_CROSS",
  "MOMENTUM",
  "BUY_THE_DIP",
  "VOLATILITY_FILTER",
  "CORE_SATELLITE",
]);

export const dcaConfigSchema = z.object({
  monthlyAmountEur: z.number().positive().max(100_000),
});

export const movingAverageConfigSchema = z.object({
  fastPeriod: z.number().int().min(2).max(200),
  slowPeriod: z.number().int().min(3).max(400),
  positionPct: z.number().min(0.1).max(1),
}).refine((data) => data.fastPeriod < data.slowPeriod, {
  message: "fastPeriod deve essere minore di slowPeriod.",
});

export const rebalanceConfigSchema = z.object({
  targetWeights: z.record(z.string(), z.number().min(0).max(1)),
  assetIds: z.array(z.string().min(1)).min(1).max(3).optional(),
});

export const momentumConfigSchema = z.object({
  lookbackDays: z.number().int().min(5).max(120),
  positionPct: z.number().min(0.1).max(1),
});

export const buyTheDipConfigSchema = z.object({
  dipPct: z.number().min(1).max(50),
  amountEur: z.number().positive().max(100_000),
  lookbackDays: z.number().int().min(3).max(60),
});

export const volatilityFilterConfigSchema = z.object({
  volPeriod: z.number().int().min(5).max(120),
  maxVolPct: z.number().min(5).max(200),
  amountEur: z.number().positive().max(100_000),
});

export const coreSatelliteConfigSchema = z.object({
  coreAmountEur: z.number().positive().max(100_000),
  satelliteAmountEur: z.number().positive().max(100_000),
});

export const walkForwardConfigSchema = z.object({
  enabled: z.boolean(),
  trainBars: z.number().int().min(10).max(2000),
  testBars: z.number().int().min(5).max(1000),
  stepBars: z.number().int().min(1).max(1000),
});

export const runBacktestSchema = z.object({
  strategyType: strategyTypeEnum,
  assetId: z.string().min(1),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  initialCapital: z.number().positive().optional(),
  commissionBps: z.number().min(0).max(500).optional(),
  slippageBps: z.number().min(0).max(500).optional(),
  config: z.record(z.unknown()).optional(),
  rebalanceAssetIds: z.array(z.string().min(1)).max(3).optional(),
  walkForward: walkForwardConfigSchema.optional(),
});

export function parseStrategyConfig(
  strategyType: z.infer<typeof runBacktestSchema>["strategyType"],
  config: Record<string, unknown> | undefined,
) {
  switch (strategyType) {
    case "DCA_MONTHLY":
      return dcaConfigSchema.parse(config ?? {});
    case "MOVING_AVERAGE_CROSS":
      return movingAverageConfigSchema.parse(config ?? {});
    case "REBALANCE_MONTHLY":
      return rebalanceConfigSchema.parse(config ?? {});
    case "MOMENTUM":
      return momentumConfigSchema.parse(config ?? {});
    case "BUY_THE_DIP":
      return buyTheDipConfigSchema.parse(config ?? {});
    case "VOLATILITY_FILTER":
      return volatilityFilterConfigSchema.parse(config ?? {});
    case "CORE_SATELLITE":
      return coreSatelliteConfigSchema.parse(config ?? {});
  }
}
