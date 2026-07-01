import { NextResponse } from "next/server";
import {
  buildDailyDecisionBrief,
  getLatestDailyDecisionBrief,
} from "@/lib/autopilot";
import { logError } from "@/lib/logger";

export async function GET() {
  try {
    const stored = await getLatestDailyDecisionBrief();
    const brief = stored ?? (await buildDailyDecisionBrief());

    return NextResponse.json({ brief });
  } catch (error) {
    logError("Request failed", error);
    return NextResponse.json(
      { error: "Errore recupero daily brief.", code: "AUTOPILOT_BRIEF_ERROR" },
      { status: 500 },
    );
  }
}
