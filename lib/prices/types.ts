export type PriceStatus = "fresh" | "stale" | "missing" | "manual";

export interface PriceQuote {
  symbol: string;
  price: number;
  currency: string;
  status: PriceStatus;
  source: string;
  capturedAt: Date;
}

export interface ResolvedPrice {
  assetId: string;
  symbol: string;
  price: number;
  currency: string;
  status: PriceStatus;
  source: string;
  capturedAt: Date | null;
  fallbackAvgPrice: number | null;
  originalPrice?: number;
  originalCurrency?: string;
  fxRate?: number;
  fxSource?: string;
}

export interface RefreshResult {
  refreshed: number;
  failed: number;
  results: Array<{
    assetId: string;
    symbol: string;
    status: PriceStatus;
    price: number | null;
    message?: string;
  }>;
}

export interface PriceProvider {
  name: string;
  fetchQuotes(symbols: string[]): Promise<PriceQuote[]>;
}

export function getPriceStaleMinutes(): number {
  const raw = process.env.PRICE_STALE_MINUTES;
  const parsed = raw ? parseInt(raw, 10) : 15;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 15;
}

export function getPriceCacheSeconds(): number {
  const raw = process.env.PRICE_CACHE_SECONDS;
  const parsed = raw ? parseInt(raw, 10) : 60;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 60;
}

export function applyStaleStatus(
  status: PriceStatus,
  capturedAt: Date,
): PriceStatus {
  if (status !== "fresh") return status;
  const staleMs = getPriceStaleMinutes() * 60 * 1000;
  if (Date.now() - capturedAt.getTime() > staleMs) {
    return "stale";
  }
  return "fresh";
}
