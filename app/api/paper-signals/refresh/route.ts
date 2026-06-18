import { NextResponse } from "next/server";
import { evaluatePromotions, refreshPaperSignalMetrics } from "@/lib/paper-signals";
import { CsrfError, verifyCsrfRequest } from "@/lib/security";

export async function POST(request: Request) {
  try {
    verifyCsrfRequest(request);
    const refreshed = await refreshPaperSignalMetrics();
    const promotion = await evaluatePromotions();
    return NextResponse.json({
      ...refreshed,
      promoted: promotion.promoted,
    });
  } catch (error) {
    if (error instanceof CsrfError) {
      return NextResponse.json(
        { error: error.message, code: "CSRF_ERROR" },
        { status: 403 },
      );
    }
    console.error(error);
    const message =
      error instanceof Error ? error.message : "Errore aggiornamento monitor.";
    return NextResponse.json(
      { error: message, code: "PAPER_SIGNALS_REFRESH_ERROR" },
      { status: 500 },
    );
  }
}
