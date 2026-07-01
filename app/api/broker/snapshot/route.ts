import { NextResponse } from "next/server";
import { z } from "zod";
import { getLatestBrokerSnapshot } from "@/lib/brokers/alpaca-account";
import { logError } from "@/lib/logger";

const querySchema = z.object({
  mode: z.enum(["MOCK", "PAPER", "LIVE"]).optional(),
});

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const parsed = querySchema.safeParse({
      mode: url.searchParams.get("mode") ?? undefined,
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten(), code: "VALIDATION_ERROR" },
        { status: 400 },
      );
    }

    const snapshot = await getLatestBrokerSnapshot(parsed.data.mode);
    return NextResponse.json({ snapshot });
  } catch (error) {
    logError("Request failed", error);
    return NextResponse.json(
      { error: "Errore nel recupero snapshot broker.", code: "BROKER_SNAPSHOT_ERROR" },
      { status: 500 },
    );
  }
}
