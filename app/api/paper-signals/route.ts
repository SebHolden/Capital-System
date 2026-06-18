import { NextResponse } from "next/server";
import { listPaperSignals } from "@/lib/paper-signals";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const strategyId = searchParams.get("strategyId") ?? undefined;
    const status = searchParams.get("status") as
      | "OPEN"
      | "CLOSED"
      | "EXPIRED"
      | undefined;

    const signals = await listPaperSignals({
      strategyId,
      status,
      limit: 50,
    });

    return NextResponse.json({ signals });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Errore nel recupero dei segnali.", code: "PAPER_SIGNALS_LIST_ERROR" },
      { status: 500 },
    );
  }
}
