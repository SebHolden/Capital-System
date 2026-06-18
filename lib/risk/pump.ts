export function evaluateAssetPump(input: {
  priceChangePct: number | null;
  maxPumpPct: number;
  lookbackDays: number;
}): { warnings: string[]; reasons: string[] } {
  const warnings: string[] = [];
  const reasons: string[] = [];

  if (input.priceChangePct === null) return { warnings, reasons };

  if (input.priceChangePct >= input.maxPumpPct) {
    reasons.push(
      `Asset in forte rialzo (+${input.priceChangePct.toFixed(1)}% negli ultimi ${input.lookbackDays} giorni).`,
    );
  } else if (input.priceChangePct >= input.maxPumpPct * 0.7) {
    warnings.push(
      `Asset in rialzo recente (+${input.priceChangePct.toFixed(1)}% / ${input.lookbackDays}g).`,
    );
  }

  return { warnings, reasons };
}

export async function computePriceChangePct(
  assetId: string,
  lookbackDays: number,
): Promise<number | null> {
  const { prisma } = await import("@/lib/db");
  const since = new Date();
  since.setDate(since.getDate() - lookbackDays);

  const snapshots = await prisma.priceSnapshot.findMany({
    where: { assetId, capturedAt: { gte: since }, price: { gt: 0 } },
    orderBy: { capturedAt: "asc" },
    take: 1,
  });

  const latest = await prisma.priceSnapshot.findFirst({
    where: { assetId, price: { gt: 0 } },
    orderBy: { capturedAt: "desc" },
  });

  if (!snapshots[0] || !latest || snapshots[0].id === latest.id) {
    return null;
  }

  const oldPrice = snapshots[0].price;
  const newPrice = latest.price;
  if (oldPrice <= 0) return null;

  return ((newPrice - oldPrice) / oldPrice) * 100;
}
