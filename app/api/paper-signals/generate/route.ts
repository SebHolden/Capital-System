import { NextResponse } from "next/server";
import { generatePaperSignals } from "@/lib/paper-signals";
import { mapMutatingSecurityError, verifyMutatingRequest } from "@/lib/security";
import { logError } from "@/lib/logger";

export async function POST(request: Request) {
  try {
    verifyMutatingRequest(request);
    const result = await generatePaperSignals();
    return NextResponse.json(result);
  } catch (error) {
    const securityError = mapMutatingSecurityError(error);
    if (securityError) return securityError;
    logError("Request failed", error);
    const message =
      error instanceof Error ? error.message : "Errore generazione segnali.";
    return NextResponse.json(
      { error: message, code: "PAPER_SIGNALS_GENERATE_ERROR" },
      { status: 500 },
    );
  }
}
