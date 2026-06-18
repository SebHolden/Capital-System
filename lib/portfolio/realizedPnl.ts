export interface RealizedPnlLog {
  side: "BUY" | "SELL";
  status: string;
  quantity: number;
  fillPrice: number | null;
  costBasisPerUnit: number | null;
  realizedPnl: number | null;
  assetId: string;
  symbol: string;
}

export interface RealizedPnlSummary {
  total: number;
  byAsset: Record<string, { symbol: string; total: number }>;
}

export function computeRealizedPnl(logs: RealizedPnlLog[]): RealizedPnlSummary {
  const byAsset: Record<string, { symbol: string; total: number }> = {};
  let total = 0;

  for (const log of logs) {
    if (log.side !== "SELL" || log.status !== "FILLED" || !log.fillPrice) {
      continue;
    }

    let pnl = log.realizedPnl;
    if (pnl === null && log.costBasisPerUnit !== null) {
      pnl = (log.fillPrice - log.costBasisPerUnit) * log.quantity;
    }
    if (pnl === null) continue;

    total += pnl;
    if (!byAsset[log.assetId]) {
      byAsset[log.assetId] = { symbol: log.symbol, total: 0 };
    }
    byAsset[log.assetId].total += pnl;
  }

  return { total, byAsset };
}
