# Seb Capital System — Quant Architecture Addendum

## Purpose

This addendum upgrades Seb Capital System from a simple private investment dashboard into a personal quant-style operating system.

The goal is not to copy retail trading bots. The goal is to build a proprietary workflow with strict risk control, journal discipline, backtesting, paper trading, broker adapters, and live execution only behind explicit safety gates.

## Core Principle

Do not build a “trading bot”. Build a private execution and decision system.

Bad architecture:

```text
Signal -> Buy/Sell -> Broker
```

Correct architecture:

```text
Data -> Research -> Strategy -> Backtest -> Paper Trading -> Risk Gate -> Journal -> Execution -> Audit -> Review
```

## Strategic Direction

Seb Capital System should follow the professional quant pattern:

1. Research first
2. Strategy definition second
3. Backtest third
4. Paper trading fourth
5. Live execution last

Retail bot platforms are useful for inspiration, but they should not be the foundation of the system. The foundation should be proprietary code, controlled rules, transparent assumptions, reproducible results, and kill-switch safety.

## Modules to Add or Strengthen

### 1. Research Layer

Purpose: Explore markets, prices, returns, volatility, drawdowns, correlations, and strategy ideas without touching execution.

Features:

- Import historical market data
- Show price charts
- Calculate daily returns
- Calculate volatility
- Calculate max drawdown
- Calculate correlations
- Compare ETF, stocks, crypto, and cash
- Support multiple timeframes

Suggested folder:

```text
lib/research/
  returns.ts
  volatility.ts
  drawdown.ts
  correlation.ts
  benchmarks.ts
```

### 2. Strategy Layer

Strategies must be pure functions. A strategy receives market data and portfolio state, then outputs a proposed signal. It never places orders directly.

Suggested interface:

```ts
export type StrategySignal = {
  symbol: string;
  side: "buy" | "sell" | "hold";
  confidence: number;
  reason: string;
  suggestedNotional: number;
};

export interface Strategy {
  id: string;
  name: string;
  description: string;
  generateSignal(input: StrategyInput): StrategySignal[];
}
```

Initial strategies:

- DCA monthly
- Rebalance to target allocation
- Moving average crossover
- Momentum filter
- Buy-the-dip with hard allocation caps
- Volatility throttle

Suggested folder:

```text
lib/strategies/
  dca.ts
  rebalance.ts
  movingAverage.ts
  momentum.ts
  volatilityThrottle.ts
```

### 3. Backtesting Engine

Backtesting must be realistic. It must include fees, slippage, delayed execution, cash constraints, and allocation limits.

Required metrics:

- Total return
- Annualized return
- Max drawdown
- Volatility
- Sharpe ratio
- Sortino ratio
- Win/loss ratio
- Exposure time
- Number of trades
- Best/worst month
- Time to recover from drawdown
- Benchmark comparison

Required controls:

- In-sample / out-of-sample split
- Walk-forward testing
- Transaction costs
- Slippage assumptions
- No look-ahead bias
- No strategy using future data

Suggested folder:

```text
lib/backtesting/
  engine.ts
  metrics.ts
  costs.ts
  walkForward.ts
  benchmark.ts
```

### 4. Paper Trading Engine

Paper trading must use the same order path as live trading, except the broker adapter is paper/mock.

Flow:

```text
Strategy signal -> proposed order -> risk gate -> journal requirement -> paper broker -> execution log -> review
```

The system must store paper orders and evaluate later outcomes:

- Result after 1 day
- Result after 7 days
- Result after 30 days
- Was the signal better than doing nothing?
- Was the signal better than benchmark?

Suggested folder:

```text
lib/paper/
  paperBroker.ts
  paperPortfolio.ts
  signalReview.ts
```

### 5. Execution Layer

Execution must support three modes:

```env
EXECUTION_MODE=mock
EXECUTION_MODE=paper
EXECUTION_MODE=live
```

Live execution must require:

- ENABLE_LIVE_TRADING=true
- Live passphrase
- Risk gate approved
- Journal completed
- Kill switch disabled
- No leverage
- Order below max size
- Daily loss limit not breached
- Monthly loss limit not breached
- Idempotency key
- Audit log entry

Suggested folder:

```text
lib/execution/
  executionEngine.ts
  orderValidator.ts
  idempotency.ts
  auditLog.ts
  liveConfirm.ts
```

### 6. Broker Adapter Layer

Broker adapters should be interchangeable and should implement the same interface.

Suggested interface:

```ts
export interface BrokerAdapter {
  name: string;
  mode: "mock" | "paper" | "live";
  getAccount(): Promise<BrokerAccount>;
  getPositions(): Promise<BrokerPosition[]>;
  placeOrder(order: BrokerOrderRequest): Promise<BrokerOrderResponse>;
  cancelOrder(orderId: string): Promise<void>;
}
```

Initial adapters:

- MockBroker
- AlpacaBroker for paper equities/US assets
- CoinbaseBroker stub for future crypto execution
- IBKRBroker stub for future advanced global execution

Important: Coinbase and IBKR should remain disabled until journal, audit log, idempotency, and kill switch are complete.

### 7. Risk Engine Upgrade

Risk engine must become the central decision authority.

Risk checks:

- Max crypto allocation
- Max experimental allocation
- Max single asset allocation
- Max order notional
- Max daily order count
- Max daily loss
- Max monthly loss
- Min cash reserve
- No leverage
- No averaging down without rule
- No trading after emotional cutoff hour
- No trade without journal
- No trade after rejected trade cooldown
- No trade if price data is stale
- No trade if market data provider failed
- No trade when kill switch is active

Suggested folder:

```text
lib/risk/
  riskEngine.ts
  checks/
    allocationCheck.ts
    cashReserveCheck.ts
    orderSizeCheck.ts
    drawdownCheck.ts
    stalePriceCheck.ts
    journalCheck.ts
    killSwitchCheck.ts
```

### 8. Journal and Behavioral Layer

Every non-passive trade must require a journal entry.

Required fields:

- Why am I entering?
- What is the thesis?
- What invalidates the thesis?
- What is the max loss I accept?
- What is the exit rule?
- Is this planned or impulsive?
- Emotional state
- Confidence score
- Time horizon

The journal should later compare intent vs result.

### 9. Database Models

Add or confirm these models:

- AccountSnapshot
- Position
- Asset
- MarketPrice
- HistoricalPrice
- Strategy
- BacktestRun
- BacktestTrade
- StrategySignal
- TradeJournal
- ProposedOrder
- ExecutedOrder
- BrokerAccount
- BrokerPosition
- RiskDecision
- AuditLog
- Settings
- KillSwitch

### 10. UI Pages

Final navigation:

```text
/dashboard
/portfolio
/research
/strategies
/backtests
/signals
/orders
/journal
/execution
/settings
```

### 11. Cursor Build Order

Cursor must not build everything at once.

Build order:

1. Database + portfolio CRUD
2. Research layer + market data storage
3. Risk engine upgrade
4. Journal mandatory flow
5. Strategy interface and first strategies
6. Backtesting engine
7. Paper trading engine
8. Execution mock and Alpaca paper
9. Reports and review tools
10. Live execution safety gates

### 12. Non-Negotiable Safety Rules

- No live trading in early milestones
- No leverage
- No futures
- No options initially
- No market orders in live mode initially
- No crypto live execution initially
- No direct strategy-to-broker path
- No broker API key exposed to client
- No trading if risk engine fails
- No trading if price data is stale
- No trading if journal is missing
- No trading if kill switch is active

## Cursor Instruction Summary

Cursor must treat Seb Capital System as a private quant-style decision and execution platform.

The system must prioritize safety, reproducibility, auditability, and risk control over speed or flashy UI.

