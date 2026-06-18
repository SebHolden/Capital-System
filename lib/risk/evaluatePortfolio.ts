import type { AssetType, Bucket } from "@prisma/client";
import type { PortfolioContext } from "./types";

const ALL_BUCKETS: Bucket[] = [
  "CASH",
  "CORE",
  "GROWTH",
  "SPECULATIVE",
  "HEDGE",
];

export function emptyBucketRecord(): Record<Bucket, number> {
  return {
    CASH: 0,
    CORE: 0,
    GROWTH: 0,
    SPECULATIVE: 0,
    HEDGE: 0,
  };
}

export function evaluatePortfolio(input: {
  cashBalance: number;
  experimentalCashBalance?: number;
  positions: Array<{
    assetId: string;
    symbol: string;
    quantity: number;
    avgPrice: number;
    currentPrice?: number;
    bucket: Bucket;
    assetType: AssetType;
  }>;
}): PortfolioContext {
  const experimentalCash = input.experimentalCashBalance ?? 0;
  const bucketValues = emptyBucketRecord();
  bucketValues.CASH = input.cashBalance + experimentalCash;

  let cryptoValue = 0;

  const positionValues = input.positions.map((position) => {
    const unitPrice = position.currentPrice ?? position.avgPrice;
    const value = position.quantity * unitPrice;
    bucketValues[position.bucket] += value;
    if (position.assetType === "CRYPTO") {
      cryptoValue += value;
    }
    return {
      assetId: position.assetId,
      symbol: position.symbol,
      value,
      pct: 0,
      bucket: position.bucket,
      assetType: position.assetType,
    };
  });

  const investedValue = positionValues.reduce((sum, p) => sum + p.value, 0);
  const totalValue = investedValue + input.cashBalance + experimentalCash;

  const bucketPcts = emptyBucketRecord();
  for (const bucket of ALL_BUCKETS) {
    bucketPcts[bucket] =
      totalValue > 0 ? (bucketValues[bucket] / totalValue) * 100 : 0;
  }

  const withPct = positionValues.map((p) => ({
    ...p,
    pct: totalValue > 0 ? (p.value / totalValue) * 100 : 0,
  }));

  return {
    totalValue,
    cashBalance: input.cashBalance,
    investedValue,
    cryptoValue,
    cryptoPct: totalValue > 0 ? (cryptoValue / totalValue) * 100 : 0,
    bucketValues,
    bucketPcts,
    positionValues: withPct,
  };
}
