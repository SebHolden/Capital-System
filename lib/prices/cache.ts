import type { PriceQuote } from "./types";
import { getPriceCacheSeconds } from "./types";

interface CacheEntry {
  quote: PriceQuote;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();

function cacheKey(source: string, symbol: string): string {
  return `${source}:${symbol.toUpperCase()}`;
}

export function getCachedQuote(
  source: string,
  symbol: string,
): PriceQuote | null {
  const entry = cache.get(cacheKey(source, symbol));
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(cacheKey(source, symbol));
    return null;
  }
  return entry.quote;
}

export function setCachedQuote(source: string, quote: PriceQuote): void {
  const ttl = getPriceCacheSeconds() * 1000;
  cache.set(cacheKey(source, quote.symbol), {
    quote,
    expiresAt: Date.now() + ttl,
  });
}

export function clearPriceCache(): void {
  cache.clear();
}
