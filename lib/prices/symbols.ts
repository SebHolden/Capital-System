import type { Asset, AssetType } from "@prisma/client";

const COINGECKO_IDS: Record<string, string> = {
  BTC: "bitcoin",
  ETH: "ethereum",
  SOL: "solana",
};

export function inferProvider(asset: Pick<Asset, "assetType" | "provider">): string | null {
  if (asset.provider) return asset.provider;
  if (asset.assetType === "CRYPTO") return "coingecko";
  if (asset.assetType === "ETF" || asset.assetType === "STOCK") return "finnhub";
  return null;
}

export function resolveProviderSymbol(
  asset: Pick<Asset, "symbol" | "assetType" | "provider" | "providerSymbol">,
): string | null {
  if (asset.providerSymbol) return asset.providerSymbol;
  if (asset.assetType === "CRYPTO") {
    return COINGECKO_IDS[asset.symbol.toUpperCase()] ?? null;
  }
  return asset.symbol.toUpperCase();
}

export function isCryptoAsset(assetType: AssetType): boolean {
  return assetType === "CRYPTO";
}

export function isEquityAsset(assetType: AssetType): boolean {
  return assetType === "ETF" || assetType === "STOCK" || assetType === "BOND";
}

export function getCoinGeckoId(symbol: string): string | null {
  return COINGECKO_IDS[symbol.toUpperCase()] ?? null;
}
