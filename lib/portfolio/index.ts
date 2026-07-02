import type { Bucket, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  effectivePrice,
  isTrustedMarketPrice,
  resolvePrice,
} from "@/lib/prices";
import type { PriceStatus, ResolvedPrice } from "@/lib/prices/types";
import {
  evaluatePortfolio,
  getPortfolioRiskSummary,
  isWithinTradingWindow,
  runStressTest,
  syncRiskBaselines,
  computeRiskScore,
  riskScoreLabel,
} from "@/lib/risk";
import { getJournalQualitySummary } from "@/lib/journal";
import { getUserSettings } from "@/lib/security";
import { computeRealizedPnl } from "./realizedPnl";

export interface PositionWithMarketPrice {
  id: string;
  assetId: string;
  quantity: number;
  avgPrice: number;
  bucket: Bucket;
  notes: string | null;
  asset: {
    id: string;
    symbol: string;
    name: string;
    assetType: string;
    bucket: Bucket;
  };
  marketPrice: number;
  priceStatus: PriceStatus;
  currentValue: number;
  unrealizedPnl: number;
  resolvedPrice: ResolvedPrice;
}

export interface PriceQuality {
  hasUntrustedPrices: boolean;
  untrustedValue: number;
  untrustedPct: number;
  staleValue: number;
  manualValue: number;
  missingValue: number;
  warnings: Array<{
    symbol: string;
    status: PriceStatus;
    value: number;
    weightPct: number;
    source: string;
    capturedAt: Date | null;
  }>;
}

export function computePriceQuality(
  positions: Array<{
    asset: { symbol: string };
    currentValue: number;
    resolvedPrice: ResolvedPrice;
  }>,
  totalValue: number,
): PriceQuality {
  let staleValue = 0;
  let manualValue = 0;
  let missingValue = 0;
  const warnings: PriceQuality["warnings"] = [];

  for (const position of positions) {
    const { status, source, capturedAt } = position.resolvedPrice;
    if (status === "fresh") continue;

    const value = position.currentValue;
    if (status === "stale") staleValue += value;
    else if (status === "manual") manualValue += value;
    else if (status === "missing") missingValue += value;

    warnings.push({
      symbol: position.asset.symbol,
      status,
      value,
      weightPct: totalValue > 0 ? (value / totalValue) * 100 : 0,
      source,
      capturedAt,
    });
  }

  const untrustedValue = staleValue + manualValue + missingValue;

  return {
    hasUntrustedPrices: warnings.length > 0,
    untrustedValue,
    untrustedPct: totalValue > 0 ? (untrustedValue / totalValue) * 100 : 0,
    staleValue,
    manualValue,
    missingValue,
    warnings,
  };
}

export async function getPositionsWithAssets(client: PrismaClient = prisma) {
  return client.position.findMany({
    include: { asset: true },
    orderBy: { updatedAt: "desc" },
  });
}

export async function getPositionsWithMarketPrices(
  client: PrismaClient = prisma,
): Promise<PositionWithMarketPrice[]> {
  const positions = await getPositionsWithAssets(client);

  const enriched = await Promise.all(
    positions.map(async (position) => {
      const resolved = await resolvePrice(position.asset, client);
      const marketPrice = effectivePrice(resolved);
      const currentValue = position.quantity * marketPrice;
      const costBasis = position.quantity * position.avgPrice;
      const unrealizedPnl = currentValue - costBasis;

      return {
        id: position.id,
        assetId: position.assetId,
        quantity: position.quantity,
        avgPrice: position.avgPrice,
        bucket: position.bucket,
        notes: position.notes,
        asset: {
          id: position.asset.id,
          symbol: position.asset.symbol,
          name: position.asset.name,
          assetType: position.asset.assetType,
          bucket: position.asset.bucket,
        },
        marketPrice,
        priceStatus: resolved.status,
        currentValue,
        unrealizedPnl,
        resolvedPrice: resolved,
      };
    }),
  );

  return enriched;
}

export async function getPortfolioSummary(client: PrismaClient = prisma) {
  const settings = await getUserSettings(client);
  const positions = await getPositionsWithMarketPrices(client);

  const displayPortfolio = evaluatePortfolio({
    cashBalance: settings.cashBalance,
    experimentalCashBalance: settings.experimentalCashBalance,
    positions: positions.map((p) => ({
      assetId: p.assetId,
      symbol: p.asset.symbol,
      quantity: p.quantity,
      avgPrice: p.avgPrice,
      currentPrice: p.marketPrice,
      bucket: p.bucket,
      assetType: p.asset.assetType as import("@prisma/client").AssetType,
    })),
  });

  const riskPortfolio = evaluatePortfolio({
    cashBalance: settings.cashBalance,
    experimentalCashBalance: settings.experimentalCashBalance,
    positions: positions.map((p) => ({
      assetId: p.assetId,
      symbol: p.asset.symbol,
      quantity: p.quantity,
      avgPrice: p.avgPrice,
      currentPrice: isTrustedMarketPrice(p.resolvedPrice) ? p.resolvedPrice.price : 0,
      bucket: p.bucket,
      assetType: p.asset.assetType as import("@prisma/client").AssetType,
    })),
  });

  const portfolio = displayPortfolio;

  const { settings: syncedSettings, metrics: riskMetrics } =
    await syncRiskBaselines(settings, riskPortfolio.totalValue, client);

  const risk = getPortfolioRiskSummary({
    bucketPcts: riskPortfolio.bucketPcts,
    maxBucketPct: syncedSettings.maxBucketPct,
    riskMetrics,
    settings: syncedSettings,
  });

  const tradingWindow = isWithinTradingWindow(syncedSettings);

  const stressTest = runStressTest(portfolio.totalValue);

  const priceWarnings = positions.filter(
    (p) => p.priceStatus !== "fresh",
  );

  const priceQuality = computePriceQuality(positions, portfolio.totalValue);

  const journalQuality = await getJournalQualitySummary(client);

  const filledSells = await client.executionLog.findMany({
    where: { status: "FILLED" },
    include: {
      orderIntent: {
        include: { asset: { select: { id: true, symbol: true, bucket: true } } },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  const realizedPnlSummary = computeRealizedPnl(
    filledSells
      .filter((log) => log.orderIntent.side === "SELL")
      .map((log) => ({
        side: log.orderIntent.side,
        status: log.status,
        quantity: log.orderIntent.quantity,
        fillPrice: log.fillPrice,
        costBasisPerUnit: log.costBasisPerUnit,
        realizedPnl: log.realizedPnl,
        assetId: log.orderIntent.asset.id,
        symbol: log.orderIntent.asset.symbol,
      })),
  );

  const speculativeInvested = portfolio.bucketValues.SPECULATIVE;
  const experimentalTotal =
    syncedSettings.experimentalCashBalance + speculativeInvested;
  const mainInvested =
    portfolio.investedValue - speculativeInvested;
  const mainTotal = syncedSettings.cashBalance + mainInvested;

  const totalValue = portfolio.totalValue;
  const positionsWithWeight = positions.map((p) => ({
    ...p,
    weightPct: totalValue > 0 ? (p.currentValue / totalValue) * 100 : 0,
  }));

  const assetTypeExposure = positions.reduce(
    (acc, p) => {
      const key = p.asset.assetType;
      acc[key] = (acc[key] ?? 0) + p.currentValue;
      return acc;
    },
    {} as Record<string, number>,
  );

  const assetTypePcts = Object.fromEntries(
    Object.entries(assetTypeExposure).map(([type, value]) => [
      type,
      totalValue > 0 ? (value / totalValue) * 100 : 0,
    ]),
  );

  const topAssets = [...positionsWithWeight]
    .sort((a, b) => b.currentValue - a.currentValue)
    .slice(0, 8)
    .map((p) => ({
      symbol: p.asset.symbol,
      name: p.asset.name,
      value: p.currentValue,
      weightPct: p.weightPct,
      assetType: p.asset.assetType,
    }));

  const cashRatio =
    totalValue > 0 ? (syncedSettings.cashBalance / totalValue) * 100 : 100;
  const investedRatio = 100 - cashRatio;
  const lifetimePnl = totalValue - syncedSettings.hypotheticalCapital;
  const lifetimePnlPct =
    syncedSettings.hypotheticalCapital > 0
      ? (lifetimePnl / syncedSettings.hypotheticalCapital) * 100
      : 0;

  const topPositionPct = Math.max(
    ...positionsWithWeight.map((p) => p.weightPct),
    0,
  );

  const riskScore = computeRiskScore({
    riskLevel: risk.level,
    drawdownPct: riskMetrics.drawdown.drawdownPct,
    maxDrawdownPct: syncedSettings.maxDrawdownPct,
    maxPositionPct: syncedSettings.maxPositionPct,
    topPositionPct,
    journalQualityAvg: journalQuality.avgQualityScore,
    hasUntrustedPrices: priceQuality.hasUntrustedPrices,
    untrustedPricePct: priceQuality.untrustedPct,
  });

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const dailyOrderCount = await client.orderIntent.count({
    where: { createdAt: { gte: startOfDay } },
  });

  const allowedOperations: string[] = [];
  const blockedOperations: string[] = [];

  if (syncedSettings.killSwitchActive) {
    blockedOperations.push("Tutte le operazioni (kill switch)");
  } else {
    allowedOperations.push("Vendite per de-risking");
    if (tradingWindow.allowed) {
      allowedOperations.push("Ordini in finestra oraria");
    } else {
      blockedOperations.push(tradingWindow.message);
    }
    if (dailyOrderCount < syncedSettings.maxDailyOrders) {
      allowedOperations.push(
        `Acquisti entro limite ordini (${syncedSettings.maxDailyOrders - dailyOrderCount} rimasti)`,
      );
    } else {
      blockedOperations.push("Limite ordini giornalieri raggiunto");
    }
    if (risk.blocked) {
      blockedOperations.push(...risk.reasons);
    }
    if (priceQuality.hasUntrustedPrices) {
      blockedOperations.push(
        "Dati prezzo non affidabili: verifica prezzi prima di operare",
      );
    }
  }

  return {
    settings: syncedSettings,
    positions: positionsWithWeight,
    portfolio,
    risk,
    riskMetrics,
    tradingWindow,
    stressTest,
    priceWarnings,
    priceQuality,
    journalQuality,
    exposure: {
      assetTypePcts,
      assetTypeExposure,
      topAssets,
      cashRatio,
      investedRatio,
      lifetimePnl,
      lifetimePnlPct,
    },
    riskScore: {
      score: riskScore,
      label: riskScoreLabel(riskScore),
    },
    operations: {
      allowed: allowedOperations,
      blocked: blockedOperations,
    },
    realizedPnl: realizedPnlSummary,
    capitalSplit: {
      mainTotal,
      experimentalTotal,
      experimentalCapital: syncedSettings.experimentalCapital,
      experimentalCashBalance: syncedSettings.experimentalCashBalance,
      speculativeInvested,
    },
  };
}

export async function getBucketAllocation(client: PrismaClient = prisma) {
  const { portfolio } = await getPortfolioSummary(client);
  return Object.entries(portfolio.bucketPcts)
    .filter(([, pct]) => pct > 0)
    .map(([bucket, pct]) => ({
      bucket: bucket as Bucket,
      value: portfolio.bucketValues[bucket as Bucket],
      pct,
    }));
}

export async function createPosition(
  data: {
    symbol: string;
    name: string;
    assetType: "ETF" | "STOCK" | "BOND" | "CRYPTO" | "OTHER";
    bucket: Bucket;
    quantity: number;
    avgPrice: number;
    notes?: string;
  },
  client: PrismaClient = prisma,
) {
  const provider =
    data.assetType === "CRYPTO"
      ? "coingecko"
      : data.assetType === "ETF" || data.assetType === "STOCK"
        ? "finnhub"
        : null;

  const asset = await client.asset.upsert({
    where: { symbol: data.symbol.toUpperCase() },
    update: {
      name: data.name,
      assetType: data.assetType,
      bucket: data.bucket,
      provider,
      providerSymbol:
        data.assetType === "CRYPTO" && data.symbol.toUpperCase() === "BTC"
          ? "bitcoin"
          : data.symbol.toUpperCase(),
    },
    create: {
      symbol: data.symbol.toUpperCase(),
      name: data.name,
      assetType: data.assetType,
      bucket: data.bucket,
      provider,
      providerSymbol:
        data.assetType === "CRYPTO" && data.symbol.toUpperCase() === "BTC"
          ? "bitcoin"
          : data.symbol.toUpperCase(),
    },
  });

  return client.position.create({
    data: {
      assetId: asset.id,
      quantity: data.quantity,
      avgPrice: data.avgPrice,
      bucket: data.bucket,
      notes: data.notes,
    },
    include: { asset: true },
  });
}

export async function updatePosition(
  id: string,
  data: {
    quantity?: number;
    avgPrice?: number;
    bucket?: Bucket;
    notes?: string;
  },
  client: PrismaClient = prisma,
) {
  return client.position.update({
    where: { id },
    data,
    include: { asset: true },
  });
}

export async function deletePosition(id: string, client: PrismaClient = prisma) {
  return client.position.delete({ where: { id } });
}

export async function getAllAssets(client: PrismaClient = prisma) {
  return client.asset.findMany({ orderBy: { symbol: "asc" } });
}
