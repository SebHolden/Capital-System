import type { Asset, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/db";
import { convertToEur } from "./fx";
import { inferProvider, isCryptoAsset } from "./symbols";
import type { PriceStatus, ResolvedPrice } from "./types";
import { applyStaleStatus } from "./types";

async function getLatestSnapshot(assetId: string, client: PrismaClient) {
  return client.priceSnapshot.findFirst({
    where: { assetId },
    orderBy: { capturedAt: "desc" },
  });
}

async function getFallbackAvgPrice(
  assetId: string,
  client: PrismaClient,
): Promise<number | null> {
  const position = await client.position.findFirst({
    where: { assetId },
    orderBy: { updatedAt: "desc" },
  });
  return position?.avgPrice ?? null;
}

export async function resolvePrice(
  asset: Asset,
  client: PrismaClient = prisma,
): Promise<ResolvedPrice> {
  const fallbackAvgPrice = await getFallbackAvgPrice(asset.id, client);
  const snapshot = await getLatestSnapshot(asset.id, client);
  const provider = inferProvider(asset);

  if (!snapshot) {
    if (fallbackAvgPrice !== null) {
      return {
        assetId: asset.id,
        symbol: asset.symbol,
        price: fallbackAvgPrice,
        currency: "EUR",
        status: "manual",
        source: "avgPrice",
        capturedAt: null,
        fallbackAvgPrice,
      };
    }
    return {
      assetId: asset.id,
      symbol: asset.symbol,
      price: 0,
      currency: "EUR",
      status: "missing",
      source: "none",
      capturedAt: null,
      fallbackAvgPrice: null,
    };
  }

  let status = snapshot.status as PriceStatus;
  if (status === "fresh" || status === "stale") {
    status = applyStaleStatus(status, snapshot.capturedAt);
  }

  const useSnapshot =
    snapshot.price > 0 && status !== "missing";

  if (useSnapshot) {
    let price = snapshot.price;
    let currency = snapshot.currency;
    let originalPrice: number | undefined;
    let originalCurrency: string | undefined;
    let fxRate: number | undefined;
    let fxSource: string | undefined;

    if (currency.toUpperCase() === "USD" && price > 0) {
      const converted = await convertToEur(price, currency);
      originalPrice = converted.originalAmount;
      originalCurrency = converted.originalCurrency;
      price = converted.amountEur;
      currency = "EUR";
      fxRate = converted.fxRate?.rate;
      fxSource = converted.fxRate?.source;
    }

    return {
      assetId: asset.id,
      symbol: asset.symbol,
      price,
      currency,
      status,
      source: snapshot.source,
      capturedAt: snapshot.capturedAt,
      fallbackAvgPrice,
      originalPrice,
      originalCurrency,
      fxRate,
      fxSource,
    };
  }

  if (fallbackAvgPrice !== null) {
    return {
      assetId: asset.id,
      symbol: asset.symbol,
      price: fallbackAvgPrice,
      currency: "EUR",
      status: "manual",
      source: "avgPrice",
      capturedAt: null,
      fallbackAvgPrice,
    };
  }

  return {
    assetId: asset.id,
    symbol: asset.symbol,
    price: 0,
    currency: "EUR",
    status: "missing",
    source: provider ?? "none",
    capturedAt: snapshot.capturedAt,
    fallbackAvgPrice: null,
  };
}

export async function resolvePricesForAssets(
  assets: Asset[],
  client: PrismaClient = prisma,
): Promise<ResolvedPrice[]> {
  return Promise.all(assets.map((asset) => resolvePrice(asset, client)));
}

export async function resolvePortfolioAssetIds(
  client: PrismaClient = prisma,
): Promise<Asset[]> {
  const positions = await client.position.findMany({
    include: { asset: true },
  });
  const seen = new Set<string>();
  const assets: Asset[] = [];
  for (const p of positions) {
    if (!seen.has(p.assetId)) {
      seen.add(p.assetId);
      assets.push(p.asset);
    }
  }
  return assets;
}

export function isMarketPriceUsable(resolved: ResolvedPrice): boolean {
  return resolved.price > 0 && resolved.status !== "missing";
}

export function effectivePrice(resolved: ResolvedPrice): number {
  if (isMarketPriceUsable(resolved)) return resolved.price;
  return resolved.fallbackAvgPrice ?? 0;
}

export { isCryptoAsset };
