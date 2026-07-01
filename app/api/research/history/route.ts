import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { fetchPriceHistory } from "@/lib/prices/history";
import { logError } from "@/lib/logger";

const querySchema = z.object({
  symbol: z.string().min(1),
  days: z.coerce.number().int().min(30).max(365).optional(),
});

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const parsed = querySchema.safeParse({
      symbol: url.searchParams.get("symbol") ?? undefined,
      days: url.searchParams.get("days") ?? undefined,
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten(), code: "VALIDATION_ERROR" },
        { status: 400 },
      );
    }

    const symbol = parsed.data.symbol.toUpperCase();
    const days = parsed.data.days ?? 90;
    const asset = await prisma.asset.findUnique({ where: { symbol } });

    if (!asset) {
      return NextResponse.json(
        { error: `Asset non trovato: ${symbol}`, code: "ASSET_NOT_FOUND" },
        { status: 404 },
      );
    }

    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - days);

    const history = await fetchPriceHistory(asset, from, to);

    return NextResponse.json({
      symbol,
      days,
      dataSource: history.dataSource,
      warning: history.warning,
      bars: history.bars,
    });
  } catch (error) {
    logError("Request failed", error);
    return NextResponse.json(
      { error: "Errore recupero storico.", code: "RESEARCH_HISTORY_ERROR" },
      { status: 500 },
    );
  }
}
