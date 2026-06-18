import { NextResponse } from "next/server";
import { z } from "zod";
import { fetchCryptoQuotesProxy } from "@/lib/prices";

const querySchema = z.object({
  symbols: z.string().min(1),
});

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const parsed = querySchema.safeParse({
      symbols: searchParams.get("symbols") ?? "BTC",
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

    const quotes = await fetchCryptoQuotesProxy(symbols);
    return NextResponse.json({ quotes });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "CoinGecko request failed", code: "CRYPTO_PRICE_ERROR" },
      { status: 502 },
    );
  }
}
