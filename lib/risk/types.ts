import type { AssetType, Bucket, RiskLevel } from "@prisma/client";
export type { RiskLevel };

export interface RiskAssessment {
  level: RiskLevel;
  reasons: string[];
  warnings: string[];
  blocked: boolean;
  allowedAmount: number;
}

export interface StressScenario {
  label: string;
  drawdownPct: number;
  portfolioValue: number;
  lossAmount: number;
}

export interface PortfolioContext {
  totalValue: number;
  cashBalance: number;
  investedValue: number;
  cryptoValue: number;
  cryptoPct: number;
  bucketValues: Record<Bucket, number>;
  bucketPcts: Record<Bucket, number>;
  positionValues: Array<{
    assetId: string;
    symbol: string;
    value: number;
    pct: number;
    bucket: Bucket;
    assetType: AssetType;
  }>;
}

export interface OrderContext {
  assetId: string;
  symbol: string;
  side: "BUY" | "SELL";
  quantity: number;
  limitPrice: number;
  orderAmount: number;
  bucket: Bucket;
  assetType: AssetType;
  journalValid: boolean;
  journalReasons: string[];
  journalLevel: RiskLevel;
  journalQualityScore: number;
  journalWarnings: string[];
  killSwitchActive: boolean;
  maxOrderAmount: number;
  maxPositionPct: number;
  maxBucketPct: number;
  minCashReserve: number;
  maxCryptoPct: number;
  dailyOrderCount: number;
  maxDailyOrders: number;
  cashBalance: number;
  currentPositionValue: number;
  currentPositionPct: number;
  projectedBucketPct: number;
  currentCryptoPct: number;
  projectedCryptoPct: number;
  maxDailyLossPct: number;
  maxMonthlyLossPct: number;
  maxExperimentalPct: number;
  maxDrawdownPct: number;
  dailyLossPct: number;
  monthlyLossPct: number;
  currentDrawdownPct: number;
  projectedExperimentalPct: number;
  currentExperimentalPct: number;
  tradingAllowed: boolean;
  tradingMessage: string;
  maxSingleCryptoPct: number;
  leverageAllowed: boolean;
  orderUsesLeverage: boolean;
  projectedSingleCryptoPct: number;
  pumpWarnings: string[];
  pumpReasons: string[];
  volatilityWarnings: string[];
  volatilityReasons: string[];
  concentrationWarnings: string[];
  concentrationReasons: string[];
  revengeWarnings: string[];
  revengeReasons: string[];
  experimentalCashBalance: number;
  experimentalCapital: number;
  currentExperimentalBudgetTotal: number;
}

export interface OrderImpact {
  orderAmount: number;
  cashBefore: number;
  cashAfter: number;
  positionValueBefore: number;
  positionValueAfter: number;
  totalValueBefore: number;
  totalValueAfter: number;
  allocationBefore: AllocationSnapshot;
  allocationAfter: AllocationSnapshot;
  stressScenarios: StressScenario[];
}

export interface AllocationSnapshot {
  bucketPcts: Record<Bucket, number>;
  cryptoPct: number;
  experimentalPct: number;
}
