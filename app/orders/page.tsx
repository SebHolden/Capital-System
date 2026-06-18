import { prisma } from "@/lib/db";
import { getAllAssets } from "@/lib/portfolio";
import { getUserSettings, isLiveTradingEnabled } from "@/lib/security";
import { OrdersClient } from "@/components/orders/OrdersClient";

export default async function OrdersPage() {
  const [assets, journals, settings] = await Promise.all([
    getAllAssets(),
    prisma.tradeJournal.findMany({ orderBy: { createdAt: "desc" } }),
    getUserSettings(),
  ]);

  return (
    <OrdersClient
      assets={assets}
      journals={journals}
      executionMode={settings.executionMode}
      liveTradingEnabled={isLiveTradingEnabled()}
      killSwitchActive={settings.killSwitchActive}
    />
  );
}
