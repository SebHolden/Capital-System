import { NextResponse } from "next/server";
import { listStrategiesWithBacktests } from "@/lib/paper-signals";

export async function GET() {
  try {
    const strategies = await listStrategiesWithBacktests();
    return NextResponse.json({ strategies });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Errore nel recupero delle strategie.", code: "STRATEGIES_LIST_ERROR" },
      { status: 500 },
    );
  }
}
