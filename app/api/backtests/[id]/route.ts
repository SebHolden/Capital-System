import { NextResponse } from "next/server";
import { getBacktestRunDetail } from "@/lib/backtesting";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const run = await getBacktestRunDetail(id);

    if (!run) {
      return NextResponse.json(
        { error: "Backtest non trovato.", code: "NOT_FOUND" },
        { status: 404 },
      );
    }

    return NextResponse.json({ run });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Errore nel recupero del backtest.", code: "BACKTEST_DETAIL_ERROR" },
      { status: 500 },
    );
  }
}
