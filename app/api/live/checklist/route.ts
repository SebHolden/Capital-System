import { NextResponse } from "next/server";
import { getUserSettings, getBrokerPermissionsChecklist } from "@/lib/security";
import { getPortfolioSummary } from "@/lib/portfolio";
import { logError } from "@/lib/logger";

export async function GET() {
  try {
    const [settings, summary] = await Promise.all([
      getUserSettings(),
      getPortfolioSummary(),
    ]);
    const checklist = await getBrokerPermissionsChecklist(
      settings,
      summary.portfolio.totalValue,
      {
        hasUntrustedPrices: summary.priceQuality.hasUntrustedPrices,
        untrustedPct: summary.priceQuality.untrustedPct,
      },
    );
    return NextResponse.json(checklist);
  } catch (error) {
    logError("Request failed", error);
    return NextResponse.json(
      {
        error: "Errore nel recupero della checklist LIVE.",
        code: "LIVE_CHECKLIST_ERROR",
      },
      { status: 500 },
    );
  }
}
