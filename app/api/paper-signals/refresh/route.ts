import { NextResponse } from "next/server";
import { evaluatePromotions, refreshPaperSignalMetrics } from "@/lib/paper-signals";
import { mapMutatingSecurityError, verifyMutatingRequest } from "@/lib/security";

export async function POST(request: Request) {
  try {
    verifyMutatingRequest(request);
    const refreshed = await refreshPaperSignalMetrics();
    const promotion = await evaluatePromotions();
    return NextResponse.json({
      ...refreshed,
      promoted: promotion.promoted,
    });
  } catch (error) {
    const securityError = mapMutatingSecurityError(error);
    if (securityError) return securityError;
    console.error(error);
    const message =
      error instanceof Error ? error.message : "Errore aggiornamento monitor.";
    return NextResponse.json(
      { error: message, code: "PAPER_SIGNALS_REFRESH_ERROR" },
      { status: 500 },
    );
  }
}
