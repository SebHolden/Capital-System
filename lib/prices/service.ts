import type { Asset, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/db";
import { fetchCryptoQuotes } from "./coingecko";
import { fetchEquityQuotes, fetchEquityQuotesInEur } from "./finnhub";
import { getCachedQuote, setCachedQuote } from "./cache";
import { inferProvider, isCryptoAsset, resolveProviderSymbol } from "./symbols";
import type { PriceQuote, RefreshResult } from "./types";

async function persistSnapshot(
  assetId: string,
  quote: PriceQuote,
  client: PrismaClient,
): Promise<void> {
  if (quote.price <= 0 && quote.status === "missing") return;

  await client.priceSnapshot.create({
    data: {
      assetId,
      price: quote.price > 0 ? quote.price : 0,
      source: quote.source,
      status: quote.status,
      currency: quote.currency,
      capturedAt: quote.capturedAt,
    },
  });
}

async function fetchQuoteForAsset(asset: Asset): Promise<PriceQuote> {
  const provider = inferProvider(asset);
  const providerSymbol = resolveProviderSymbol(asset);

  if (!provider || !providerSymbol) {
    return {
      symbol: asset.symbol,
      price: 0,
      currency: "EUR",
      status: "manual",
      source: "manual",
      capturedAt: new Date(),
    };
  }

  const cached = getCachedQuote(provider, asset.symbol);
  if (cached) return cached;

  let quotes: PriceQuote[] = [];

  if (provider === "coingecko" && isCryptoAsset(asset.assetType)) {
    quotes = await fetchCryptoQuotes([asset.symbol]);
  } else if (provider === "finnhub") {
    quotes = await fetchEquityQuotesInEur([providerSymbol]);
    if (quotes[0]?.status === "manual") {
      return {
        symbol: asset.symbol,
        price: 0,
        currency: "EUR",
        status: "manual",
        source: "manual",
        capturedAt: new Date(),
      };
    }
  }

  const quote =
    quotes[0] ?? {
      symbol: asset.symbol,
      price: 0,
      currency: "EUR",
      status: "missing" as const,
      source: provider,
      capturedAt: new Date(),
    };

  if (quote.price > 0) {
    setCachedQuote(provider, quote);
  }

  return quote;
}

export async function refreshAssetPrice(
  asset: Asset,
  client: PrismaClient = prisma,
): Promise<RefreshResult["results"][number]> {
  try {
    const quote = await fetchQuoteForAsset(asset);

    if (quote.price > 0 && quote.status !== "manual") {
      await persistSnapshot(asset.id, quote, client);
      return {
        assetId: asset.id,
        symbol: asset.symbol,
        status: quote.status,
        price: quote.price,
      };
    }

    if (quote.status === "manual") {
      return {
        assetId: asset.id,
        symbol: asset.symbol,
        status: "manual",
        price: null,
        message: "Finnhub non configurato — usa prezzo medio manuale.",
      };
    }

    const lastSnapshot = await client.priceSnapshot.findFirst({
      where: { assetId: asset.id },
      orderBy: { capturedAt: "desc" },
    });

    if (lastSnapshot) {
      return {
        assetId: asset.id,
        symbol: asset.symbol,
        status: "stale",
        price: lastSnapshot.price,
        message: "API non disponibile — ultimo prezzo in cache DB.",
      };
    }

    return {
      assetId: asset.id,
      symbol: asset.symbol,
      status: "missing",
      price: null,
      message: "Nessun prezzo disponibile.",
    };
  } catch (error) {
    return {
      assetId: asset.id,
      symbol: asset.symbol,
      status: "missing",
      price: null,
      message: error instanceof Error ? error.message : "Errore refresh",
    };
  }
}

export async function refreshPrices(
  assetIds?: string[],
  client: PrismaClient = prisma,
): Promise<RefreshResult> {
  const assets = assetIds?.length
    ? await client.asset.findMany({ where: { id: { in: assetIds } } })
    : await client.asset.findMany({
        where: {
          positions: { some: {} },
        },
      });

  const results: RefreshResult["results"] = [];
  let refreshed = 0;
  let failed = 0;

  for (const asset of assets) {
    const result = await refreshAssetPrice(asset, client);
    results.push(result);
    if (result.status === "fresh" || result.status === "stale") {
      if (result.price !== null) refreshed++;
      else failed++;
    } else if (result.status === "manual") {
      // not a failure — expected without Finnhub key
    } else {
      failed++;
    }
  }

  return { refreshed, failed, results };
}

export async function fetchCryptoQuotesProxy(
  symbols: string[],
): Promise<PriceQuote[]> {
  return fetchCryptoQuotes(symbols);
}

export async function fetchEquityQuotesProxy(
  symbols: string[],
): Promise<PriceQuote[]> {
  return fetchEquityQuotes(symbols);
}
