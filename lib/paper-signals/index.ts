import type { PaperSignalStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/security";
import type { PerformanceMetrics } from "@/lib/backtesting/types";
import { checkBacktestEligibility } from "./eligibility";
import { generatePaperSignals } from "./generate";
import { refreshPaperSignalMetrics } from "./monitor";
import { evaluatePromotions } from "./promotion";

export class PaperActivationError extends Error {
  constructor(
    message: string,
    public readonly reasons: string[],
  ) {
    super(message);
    this.name = "PaperActivationError";
  }
}

export async function listPaperSignals(options?: {
  strategyId?: string;
  status?: PaperSignalStatus;
  limit?: number;
}) {
  return prisma.paperSignal.findMany({
    where: {
      strategyId: options?.strategyId,
      status: options?.status,
    },
    take: options?.limit ?? 50,
    orderBy: { signalDate: "desc" },
    include: {
      strategy: true,
      asset: true,
    },
  });
}

export async function listStrategiesWithBacktests() {
  const strategies = await prisma.strategy.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      primaryAsset: true,
      backtestRuns: {
        where: { status: "COMPLETED" },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
      _count: { select: { paperSignals: true } },
    },
  });

  return strategies.map((strategy) => {
    const latestRun = strategy.backtestRuns[0] ?? null;
    let metrics: PerformanceMetrics | null = null;
    if (latestRun) {
      try {
        metrics = JSON.parse(latestRun.metricsJson) as PerformanceMetrics;
      } catch {
        metrics = null;
      }
    }

    const eligibility = checkBacktestEligibility(latestRun);

    return {
      id: strategy.id,
      name: strategy.name,
      description: strategy.description,
      type: strategy.type,
      status: strategy.status,
      primaryAssetId: strategy.primaryAssetId,
      primaryAsset: strategy.primaryAsset,
      paperActiveAt: strategy.paperActiveAt,
      promotedAt: strategy.promotedAt,
      signalCount: strategy._count.paperSignals,
      latestBacktest: latestRun
        ? {
            id: latestRun.id,
            createdAt: latestRun.createdAt,
            metrics,
          }
        : null,
      paperEligible: eligibility.eligible,
      paperEligibilityReasons: eligibility.reasons,
    };
  });
}

export async function activatePaperStrategy(
  strategyId: string,
  primaryAssetId?: string,
) {
  const strategy = await prisma.strategy.findUniqueOrThrow({
    where: { id: strategyId },
    include: {
      backtestRuns: {
        where: { status: "COMPLETED" },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  const latestRun = strategy.backtestRuns[0];
  const eligibility = checkBacktestEligibility(latestRun);

  if (!eligibility.eligible) {
    throw new PaperActivationError(
      "Strategia non idonea per paper trading.",
      eligibility.reasons,
    );
  }

  const assetId = primaryAssetId ?? latestRun?.assetId ?? strategy.primaryAssetId;
  if (!assetId) {
    throw new PaperActivationError("Asset principale non definito.", [
      "Specifica primaryAssetId o esegui un backtest.",
    ]);
  }

  const updated = await prisma.strategy.update({
    where: { id: strategyId },
    data: {
      status: "PAPER_ACTIVE",
      primaryAssetId: assetId,
      paperActiveAt: new Date(),
    },
  });

  await writeAuditLog("STRATEGY_PAPER_ACTIVATED", "Strategy", {
    strategyId,
    primaryAssetId: assetId,
  });

  return updated;
}

export async function runPaperSignalsPipeline() {
  const generated = await generatePaperSignals();
  const refreshed = await refreshPaperSignalMetrics();
  const promotion = await evaluatePromotions();

  return {
    generated,
    refreshed,
    promotion,
  };
}

export { generatePaperSignals } from "./generate";
export { refreshPaperSignalMetrics } from "./monitor";
export { evaluatePromotions } from "./promotion";
export { checkBacktestEligibility } from "./eligibility";
