export function getDefaultCommissionBps(): number {
  const raw = process.env.BACKTEST_DEFAULT_COMMISSION_BPS;
  const parsed = raw ? parseFloat(raw) : 10;
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 10;
}

export function getDefaultSlippageBps(): number {
  const raw = process.env.BACKTEST_DEFAULT_SLIPPAGE_BPS;
  const parsed = raw ? parseFloat(raw) : 10;
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 10;
}

export function applyBuyCosts(price: number, slippageBps: number): number {
  return price * (1 + slippageBps / 10_000);
}

export function applySellCosts(price: number, slippageBps: number): number {
  return price * (1 - slippageBps / 10_000);
}

export function computeFees(notional: number, commissionBps: number): number {
  return notional * (commissionBps / 10_000);
}
