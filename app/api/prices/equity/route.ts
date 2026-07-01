import { NextResponse } from "next/server";
import { z } from "zod";
import { fetchEquityQuotesProxy, isFinnhubEnabled } from "@/lib/prices";
import { logError } from "@/lib/logger";

const querySchema = z.object({
  symbols: z.string().min(1),
});

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const parsed = querySchema.safeParse({
      symbols: searchParams.get("symbols") ?? "",
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten(), code: "VALIDATION_ERROR" },
        { status: 400 },
      );
    }

    const symbols = parsed.data.symbols
      .split(",")
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean);

    if (!isFinnhubEnabled()) {
      return NextResponse.json({
        manual: true,
        message: "FINNHUB_API_KEY non configurata — usa prezzi manuali.",
        quotes: symbols.map((symbol) => ({
          symbol,
          price: 0,
          currency: "EUR",
          status: "manual",
          source: "manual",
        })),
      });
    }

    const quotes = await fetchEquityQuotesProxy(symbols);
    return NextResponse.json({ manual: false, quotes });
  } catch (error) {
    logError("Request failed", error);
    return NextResponse.json(
      { error: "Finnhub request failed", code: "EQUITY_PRICE_ERROR" },
      { status: 502 },
    );
  }
}
