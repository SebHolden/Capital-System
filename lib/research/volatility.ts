export function annualizedVolatility(dailyReturns: number[]): number | null {
  if (dailyReturns.length < 2) return null;
  const mean =
    dailyReturns.reduce((sum, r) => sum + r, 0) / dailyReturns.length;
  const variance =
    dailyReturns.reduce((sum, r) => sum + (r - mean) ** 2, 0) /
    (dailyReturns.length - 1);
  const dailyVol = Math.sqrt(variance);
  return dailyVol * Math.sqrt(252) * 100;
}
