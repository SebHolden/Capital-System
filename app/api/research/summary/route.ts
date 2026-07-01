import { NextResponse } from "next/server";
import { z } from "zod";
import { buildResearchSummary } from "@/lib/research";
import { logError } from "@/lib/logger";

const querySchema = z.object({
  symbols: z.string().optional(),
  days: z.coerce.number().int().min(30).max(365).optional(),
});

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const parsed = querySchema.safeParse({
      symbols: url.searchParams.get("symbols") ?? undefined,
      days: url.searchParams.get("days") ?? undefined,
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten(), code: "VALIDATION_ERROR" },
        { status: 400 },
      );
    }

    const symbols = parsed.data.symbols
      ? parsed.data.symbols.split(",").map((s) => s.trim()).filter(Boolean)
      : undefined;

    const summary = await buildResearchSummary(symbols, parsed.data.days ?? 90);
    return NextResponse.json(summary);
  } catch (error) {
    logError("Request failed", error);
    return NextResponse.json(
      { error: "Errore research summary.", code: "RESEARCH_SUMMARY_ERROR" },
      { status: 500 },
    );
  }
}
