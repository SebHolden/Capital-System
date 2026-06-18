export function computeRollingVolatilityPct(prices: number[]): number | null {
  if (prices.length < 3) return null;

  const returns: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    if (prices[i - 1] <= 0) continue;
    returns.push((prices[i] - prices[i - 1]) / prices[i - 1]);
  }

  if (returns.length < 2) return null;

  const mean = returns.reduce((s, r) => s + r, 0) / returns.length;
  const variance =
    returns.reduce((s, r) => s + (r - mean) ** 2, 0) / (returns.length - 1);
  const stdDev = Math.sqrt(variance);

  return stdDev * Math.sqrt(252) * 100;
}

export function evaluateVolatility(input: {
  volatilityPct: number | null;
  maxVolatilityPct: number;
}): { warnings: string[]; reasons: string[] } {
  const warnings: string[] = [];
  const reasons: string[] = [];

  if (input.volatilityPct === null) return { warnings, reasons };

  if (input.volatilityPct > input.maxVolatilityPct) {
    reasons.push(
      `Volatilità asset elevata (${input.volatilityPct.toFixed(1)}% annua stimata).`,
    );
  } else if (input.volatilityPct > input.maxVolatilityPct * 0.75) {
    warnings.push(
      `Volatilità asset elevata (${input.volatilityPct.toFixed(1)}% annua stimata).`,
    );
  }

  return { warnings, reasons };
}

export async function computeAssetVolatilityPct(
  assetId: string,
  lookbackDays = 30,
): Promise<number | null> {
  const { prisma } = await import("@/lib/db");
  const since = new Date();
  since.setDate(since.getDate() - lookbackDays);

  const snapshots = await prisma.priceSnapshot.findMany({
    where: { assetId, capturedAt: { gte: since }, price: { gt: 0 } },
    orderBy: { capturedAt: "asc" },
    select: { price: true },
  });

  return computeRollingVolatilityPct(snapshots.map((s) => s.price));
}
