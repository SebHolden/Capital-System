import { NextResponse } from "next/server";
import { listPaperSignals } from "@/lib/paper-signals";
import { listPaperSignalsSchema } from "@/lib/paper-signals/schemas";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const parsed = listPaperSignalsSchema.safeParse({
      strategyId: searchParams.get("strategyId") ?? undefined,
      status: searchParams.get("status") ?? undefined,
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Parametri non validi.", code: "PAPER_SIGNALS_VALIDATION_ERROR" },
        { status: 400 },
      );
    }

    const limitRaw = searchParams.get("limit");
    const limit = limitRaw ? parseInt(limitRaw, 10) : 50;

    const signals = await listPaperSignals({
      ...parsed.data,
      limit: Number.isFinite(limit) && limit > 0 ? limit : 50,
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
