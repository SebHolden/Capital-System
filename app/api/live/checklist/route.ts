import { NextResponse } from "next/server";
import { getUserSettings, getBrokerPermissionsChecklist } from "@/lib/security";
import { getPortfolioSummary } from "@/lib/portfolio";

export async function GET() {
  try {
    const [settings, { portfolio }] = await Promise.all([
      getUserSettings(),
      getPortfolioSummary(),
    ]);
    const checklist = await getBrokerPermissionsChecklist(
      settings,
      portfolio.totalValue,
    );
    return NextResponse.json(checklist);
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      {
        error: "Errore nel recupero della checklist LIVE.",
        code: "LIVE_CHECKLIST_ERROR",
      },
      { status: 500 },
    );
  }
}
