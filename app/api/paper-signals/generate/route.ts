import { NextResponse } from "next/server";
import { generatePaperSignals } from "@/lib/paper-signals";
import { CsrfError, verifyCsrfRequest } from "@/lib/security";

export async function POST(request: Request) {
  try {
    verifyCsrfRequest(request);
    const result = await generatePaperSignals();
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof CsrfError) {
      return NextResponse.json(
        { error: error.message, code: "CSRF_ERROR" },
        { status: 403 },
      );
    }
    console.error(error);
    const message =
      error instanceof Error ? error.message : "Errore generazione segnali.";
    return NextResponse.json(
      { error: message, code: "PAPER_SIGNALS_GENERATE_ERROR" },
      { status: 500 },
    );
  }
}
