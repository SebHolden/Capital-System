import type { PriceQuote } from "./types";
import { getCoinGeckoId } from "./symbols";

export async function fetchCryptoQuotes(symbols: string[]): Promise<PriceQuote[]> {
  const normalized = symbols.map((s) => s.toUpperCase());
  const idBySymbol = new Map<string, string>();

  for (const symbol of normalized) {
    const id = getCoinGeckoId(symbol);
    if (id) idBySymbol.set(symbol, id);
  }

  const coinIds = [...new Set(idBySymbol.values())];
  if (coinIds.length === 0) return [];

  const url = `https://api.coingecko.com/api/v3/simple/price?ids=${coinIds.join(",")}&vs_currencies=eur`;

  try {
    const response = await fetch(url, { next: { revalidate: 60 } });
    if (!response.ok) {
      return normalized.map((symbol) => ({
        symbol,
        price: 0,
        currency: "EUR",
        status: "missing" as const,
        source: "coingecko",
        capturedAt: new Date(),
      }));
    }

    const data = (await response.json()) as Record<string, { eur?: number }>;
    const now = new Date();

    return normalized.map((symbol) => {
      const id = idBySymbol.get(symbol);
      const price = id && data[id]?.eur ? data[id].eur! : 0;
      return {
        symbol,
        price,
        currency: "EUR",
        status: price > 0 ? ("fresh" as const) : ("missing" as const),
        source: "coingecko",
        capturedAt: now,
      };
    });
  } catch {
    return normalized.map((symbol) => ({
      symbol,
      price: 0,
      currency: "EUR",
      status: "missing" as const,
      source: "coingecko",
      capturedAt: new Date(),
    }));
  }
}
