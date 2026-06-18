import type { PriceQuote } from "./types";
import { convertToEur } from "./fx";

export async function normalizeQuoteToEur(quote: PriceQuote): Promise<PriceQuote & {
  originalPrice?: number;
  originalCurrency?: string;
  fxRate?: number;
  fxSource?: string;
}> {
  if (quote.currency.toUpperCase() === "EUR" || quote.price <= 0) {
    return quote;
  }

  const converted = await convertToEur(quote.price, quote.currency);
  return {
    ...quote,
    price: converted.amountEur,
    currency: "EUR",
    originalPrice: converted.originalAmount,
    originalCurrency: converted.originalCurrency,
    fxRate: converted.fxRate?.rate,
    fxSource: converted.fxRate?.source,
  };
}

function getFinnhubKey(): string | null {
  const key = process.env.FINNHUB_API_KEY;
  return key && key.trim().length > 0 ? key.trim() : null;
}

export function isFinnhubEnabled(): boolean {
  return getFinnhubKey() !== null;
}

export async function fetchEquityQuotes(symbols: string[]): Promise<PriceQuote[]> {
  const apiKey = getFinnhubKey();
  const normalized = symbols.map((s) => s.toUpperCase());

  if (!apiKey) {
    return normalized.map((symbol) => ({
      symbol,
      price: 0,
      currency: "EUR",
      status: "manual" as const,
      source: "finnhub",
      capturedAt: new Date(),
    }));
  }

  const now = new Date();
  const results: PriceQuote[] = [];

  for (const symbol of normalized) {
    try {
      const url = `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${apiKey}`;
      const response = await fetch(url, { next: { revalidate: 60 } });
      if (!response.ok) {
        results.push({
          symbol,
          price: 0,
          currency: "USD",
          status: "missing",
          source: "finnhub",
          capturedAt: now,
        });
        continue;
      }

      const data = (await response.json()) as { c?: number };
      const price = typeof data.c === "number" && data.c > 0 ? data.c : 0;
      results.push({
        symbol,
        price,
        currency: "USD",
        status: price > 0 ? "fresh" : "missing",
        source: "finnhub",
        capturedAt: now,
      });
    } catch {
      results.push({
        symbol,
        price: 0,
        currency: "USD",
        status: "missing",
        source: "finnhub",
        capturedAt: now,
      });
    }
  }

  return results;
}

export async function fetchEquityQuotesInEur(
  symbols: string[],
): Promise<PriceQuote[]> {
  const quotes = await fetchEquityQuotes(symbols);
  return Promise.all(
    quotes.map(async (quote) => {
      const normalized = await normalizeQuoteToEur(quote);
      return normalized;
    }),
  );
}
