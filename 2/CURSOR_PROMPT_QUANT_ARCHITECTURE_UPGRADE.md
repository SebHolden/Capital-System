You are working on Seb Capital System, a private Next.js investment/risk/trading system.

Important: Do NOT build a retail-style trading bot. Build a personal quant-style decision and execution platform.

Core flow:

Data -> Research -> Strategy -> Backtest -> Paper Trading -> Risk Gate -> Journal -> Execution -> Audit -> Review

Never allow:

Signal -> Broker

Current priority: upgrade the architecture so future trading execution is professional and safe.

Tasks:

1. Add a research layer
   - lib/research/returns.ts
   - lib/research/volatility.ts
   - lib/research/drawdown.ts
   - lib/research/correlation.ts
   - lib/research/benchmarks.ts

2. Add a strategy interface
   - lib/strategies/types.ts
   - Strategies must be pure functions
   - Strategies can generate signals but must never place orders

3. Add initial strategies
   - DCA monthly
   - Rebalance to target allocation
   - Moving average crossover
   - Momentum filter
   - Volatility throttle

4. Add a backtesting skeleton
   - lib/backtesting/engine.ts
   - lib/backtesting/metrics.ts
   - lib/backtesting/costs.ts
   - Include transaction fees, slippage, cash constraints, and benchmark comparison
   - Avoid look-ahead bias

5. Upgrade risk engine
   Add checks for:
   - max crypto allocation
   - max experimental allocation
   - max single asset allocation
   - max order notional
   - max daily loss
   - max monthly loss
   - min cash reserve
   - stale price data
   - missing journal
   - kill switch
   - leverage prohibited

6. Add broker adapter interface
   - lib/brokers/types.ts
   - MockBroker remains default
   - Alpaca paper adapter may exist but must be disabled unless env vars are present
   - Coinbase and IBKR should be stubs only for now

7. Add execution safety
   - live trading must require EXECUTION_MODE=live and ENABLE_LIVE_TRADING=true
   - live execution must require passphrase confirmation
   - every attempted order must be logged
   - if risk engine fails or throws, block the order

8. Add UI placeholders
   - /research
   - /strategies
   - /backtests
   - /signals
   - /execution

9. Keep everything type-safe
   - Run npm run lint
   - Run npm run typecheck if available
   - Do not introduce API keys client-side

Do not implement actual live order placement yet.
The output should be a safe architecture foundation, not a money-moving bot.
