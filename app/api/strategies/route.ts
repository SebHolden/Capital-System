import { NextResponse } from "next/server";
import { logError } from "@/lib/logger";
import {
  getPaperStrategyRankings,
  listStrategiesWithBacktests,
} from "@/lib/paper-signals";

export async function GET() {
  try {
    const [strategies, paperRankings] = await Promise.all([
      listStrategiesWithBacktests(),
      getPaperStrategyRankings(),
    ]);
    return NextResponse.json({ strategies, paperRankings });
  } catch (error) {
    logError("Request failed", error);
    return NextResponse.json(
      { error: "Errore nel recupero delle strategie.", code: "STRATEGIES_LIST_ERROR" },
      { status: 500 },
    );
  }
}
