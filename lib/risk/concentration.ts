export interface ConcentrationInput {
  positions: Array<{
    symbol: string;
    assetType: string;
    bucket: string;
    value: number;
  }>;
  orderSymbol: string;
  orderAssetType: string;
  orderBucket: string;
  orderValue: number;
  totalPortfolioValue: number;
}

export function evaluateConcentration(input: ConcentrationInput): {
  warnings: string[];
  reasons: string[];
} {
  const warnings: string[] = [];
  const reasons: string[] = [];

  if (input.totalPortfolioValue <= 0) {
    return { warnings, reasons };
  }

  const correlatedGroups: Record<string, string[]> = {
    crypto_growth: ["CRYPTO", "GROWTH"],
    core_speculative: ["CORE", "SPECULATIVE"],
  };

  const bucketValues = new Map<string, number>();
  for (const p of input.positions) {
    bucketValues.set(p.bucket, (bucketValues.get(p.bucket) ?? 0) + p.value);
  }

  const orderBucket = input.orderBucket;
  bucketValues.set(
    orderBucket,
    (bucketValues.get(orderBucket) ?? 0) + input.orderValue,
  );

  const cryptoGrowthExposure =
    ((bucketValues.get("SPECULATIVE") ?? 0) +
      input.positions
        .filter((p) => p.assetType === "CRYPTO")
        .reduce((s, p) => s + p.value, 0) +
      (input.orderAssetType === "CRYPTO" ? input.orderValue : 0)) /
    input.totalPortfolioValue;

  if (cryptoGrowthExposure > 0.35) {
    warnings.push(
      `Esposizione combinata crypto/speculative elevata (${(cryptoGrowthExposure * 100).toFixed(1)}%).`,
    );
  }

  if (
    input.orderAssetType === "CRYPTO" &&
    input.positions.some(
      (p) => p.assetType === "CRYPTO" && p.symbol !== input.orderSymbol,
    )
  ) {
    const cryptoSymbols = new Set(
      input.positions.filter((p) => p.assetType === "CRYPTO").map((p) => p.symbol),
    );
    if (cryptoSymbols.size >= 2) {
      warnings.push("Concentrazione su più crypto correlate.");
    }
  }

  void correlatedGroups;
  return { warnings, reasons };
}
