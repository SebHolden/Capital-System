import { getPortfolioSummary } from "@/lib/portfolio";
import { PortfolioClient } from "@/components/portfolio/PortfolioClient";

export default async function PortfolioPage() {
  const summary = await getPortfolioSummary();

  return (
    <PortfolioClient
      realizedPnlTotal={summary.realizedPnl.total}
      initialPositions={summary.positions.map((p) => ({
        id: p.id,
        quantity: p.quantity,
        avgPrice: p.avgPrice,
        bucket: p.bucket,
        notes: p.notes,
        asset: p.asset,
        marketPrice: p.marketPrice,
        priceStatus: p.priceStatus,
        currentValue: p.currentValue,
        unrealizedPnl: p.unrealizedPnl,
        weightPct: p.weightPct,
      }))}
    />
  );
}
