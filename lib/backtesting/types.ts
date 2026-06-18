export interface EquityPoint {
  date: string;
  value: number;
}

export interface SimulatedTrade {
  date: string;
  side: "BUY" | "SELL";
  quantity: number;
  price: number;
  fees: number;
  reason: string;
  assetId: string;
}

export interface PortfolioState {
  cash: number;
  positions: Record<string, number>;
}

export interface PerformanceMetrics {
  totalReturnPct: number;
  cagrPct: number;
  volatilityPct: number;
  maxDrawdownPct: number;
  sharpeRatio: number;
  sortinoRatio: number;
  winRatePct: number;
  tradeCount: number;
  avgHoldingDays: number;
  worstMonthPct: number;
  bestMonthPct: number;
  recoveryDays: number | null;
  finalValue: number;
}

export interface BacktestSimulationResult {
  trades: SimulatedTrade[];
  equityCurve: EquityPoint[];
  metrics: PerformanceMetrics;
  benchmarkMetrics: PerformanceMetrics;
  finalState: PortfolioState;
}

export interface RunBacktestInput {
  strategyType:
    | "DCA_MONTHLY"
    | "REBALANCE_MONTHLY"
    | "MOVING_AVERAGE_CROSS"
    | "MOMENTUM"
    | "BUY_THE_DIP"
    | "VOLATILITY_FILTER"
    | "CORE_SATELLITE";
  assetId: string;
  startDate: Date;
  endDate: Date;
  initialCapital?: number;
  commissionBps?: number;
  slippageBps?: number;
  config?: Record<string, unknown>;
  rebalanceAssetIds?: string[];
}
