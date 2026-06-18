import type { Asset } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  getCoinGeckoId,
  isCryptoAsset,
  isEquityAsset,
} from "./symbols";

export interface PriceBar {
  date: string;
  close: number;
}

export interface PriceHistoryResult {
  bars: PriceBar[];
  dataSource: "coingecko" | "finnhub" | "synthetic" | "database";
  warning?: string;
}

const EU_DENYLIST = new Set(["SWDA", "EIMI", "SGLD", "VWCE", "CSPX"]);

function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function normalizeDailyBars(bars: PriceBar[]): PriceBar[] {
  const byDate = new Map<string, number>();
  for (const bar of bars) {
    byDate.set(bar.date, bar.close);
  }
  return [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, close]) => ({ date, close }));
}

async function fetchCryptoHistory(
  symbol: string,
  from: Date,
  to: Date,
): Promise<PriceBar[]> {
  const coinId = getCoinGeckoId(symbol);
  if (!coinId) return [];

  const fromSec = Math.floor(from.getTime() / 1000);
  const toSec = Math.floor(to.getTime() / 1000);
  const url = `https://api.coingecko.com/api/v3/coins/${coinId}/market_chart/range?vs_currency=eur&from=${fromSec}&to=${toSec}`;

  const response = await fetch(url, { next: { revalidate: 3600 } });
  if (!response.ok) return [];

  const data = (await response.json()) as {
    prices?: Array<[number, number]>;
  };

  const bars: PriceBar[] = (data.prices ?? []).map(([ts, price]) => ({
    date: toDateKey(new Date(ts)),
    close: price,
  }));

  return normalizeDailyBars(bars);
}

async function fetchFinnhubHistory(
  symbol: string,
  from: Date,
  to: Date,
): Promise<PriceBar[]> {
  const apiKey = process.env.FINNHUB_API_KEY?.trim();
  if (!apiKey) return [];

  const fromSec = Math.floor(from.getTime() / 1000);
  const toSec = Math.floor(to.getTime() / 1000);
  const url = `https://finnhub.io/api/v1/stock/candle?symbol=${encodeURIComponent(symbol)}&resolution=D&from=${fromSec}&to=${toSec}&token=${apiKey}`;

  const response = await fetch(url, { next: { revalidate: 3600 } });
  if (!response.ok) return [];

  const data = (await response.json()) as {
    s?: string;
    t?: number[];
    c?: number[];
  };

  if (data.s !== "ok" || !data.t || !data.c) return [];

  const bars: PriceBar[] = data.t.map((ts, i) => ({
    date: toDateKey(new Date(ts * 1000)),
    close: data.c![i],
  }));

  return normalizeDailyBars(bars);
}

async function resolveBasePrice(asset: Asset): Promise<number> {
  const snapshot = await prisma.priceSnapshot.findFirst({
    where: { assetId: asset.id },
    orderBy: { capturedAt: "desc" },
  });
  if (snapshot && snapshot.price > 0) return snapshot.price;

  const position = await prisma.position.findFirst({
    where: { assetId: asset.id },
  });
  if (position && position.avgPrice > 0) return position.avgPrice;

  return 100;
}

function buildSyntheticHistory(
  asset: Asset,
  from: Date,
  to: Date,
  basePrice: number,
): PriceBar[] {
  const bars: PriceBar[] = [];
  const cursor = new Date(from);
  cursor.setUTCHours(0, 0, 0, 0);

  let price = basePrice * 0.85;
  const seed = asset.symbol
    .split("")
    .reduce((sum, ch) => sum + ch.charCodeAt(0), 0);

  while (cursor <= to) {
    const dayIndex = Math.floor(
      (cursor.getTime() - from.getTime()) / (24 * 60 * 60 * 1000),
    );
    const drift = Math.sin((dayIndex + seed) / 30) * 0.008;
    const noise = Math.sin((dayIndex + seed) / 7) * 0.004;
    price = Math.max(price * (1 + drift + noise), basePrice * 0.5);

    bars.push({
      date: toDateKey(cursor),
      close: price,
    });

    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return bars;
}

export function getBacktestMaxYears(): number {
  const raw = process.env.BACKTEST_MAX_YEARS;
  const parsed = raw ? parseInt(raw, 10) : 5;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 5;
}

export async function fetchPriceHistory(
  asset: Asset,
  from: Date,
  to: Date,
): Promise<PriceHistoryResult> {
  const maxYears = getBacktestMaxYears();
  const maxMs = maxYears * 365 * 24 * 60 * 60 * 1000;
  if (to.getTime() - from.getTime() > maxMs) {
    throw new Error(`Intervallo massimo consentito: ${maxYears} anni.`);
  }

  const fromKey = toDateKey(from);
  const toKey = toDateKey(to);
  const dbRows = await prisma.historicalPrice.findMany({
    where: {
      assetId: asset.id,
      priceDate: { gte: fromKey, lte: toKey },
    },
    orderBy: { priceDate: "asc" },
  });

  if (dbRows.length >= 2) {
    return {
      bars: dbRows.map((row) => ({ date: row.priceDate, close: row.close })),
      dataSource: "database",
    };
  }

  if (isCryptoAsset(asset.assetType)) {
    const bars = await fetchCryptoHistory(asset.symbol, from, to);
    if (bars.length > 0) {
      return { bars, dataSource: "coingecko" };
    }
  }

  if (
    isEquityAsset(asset.assetType) &&
    !EU_DENYLIST.has(asset.symbol.toUpperCase())
  ) {
    const bars = await fetchFinnhubHistory(asset.symbol.toUpperCase(), from, to);
    if (bars.length > 0) {
      return { bars, dataSource: "finnhub" };
    }
  }

  const basePrice = await resolveBasePrice(asset);
  const bars = buildSyntheticHistory(asset, from, to, basePrice);

  return {
    bars,
    dataSource: "synthetic",
    warning:
      "Serie storica sintetica: dati reali non disponibili per questo asset. I risultati sono indicativi.",
  };
}

export async function fetchMultiAssetHistory(
  assets: Asset[],
  from: Date,
  to: Date,
): Promise<Map<string, PriceHistoryResult>> {
  const results = new Map<string, PriceHistoryResult>();
  for (const asset of assets) {
    results.set(asset.id, await fetchPriceHistory(asset, from, to));
  }
  return results;
}
