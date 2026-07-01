import type { StrategyType } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  fetchMultiAssetHistory,
} from "@/lib/prices/history";
import { getUserSettings, writeAuditLog } from "@/lib/security";
import {
  getDefaultStrategyConfig,
  getStrategyDefinition,
  getStrategyDisplayName,
} from "@/lib/strategies";
import { runBuyAndHoldBenchmark } from "./benchmark";
import {
  getDefaultCommissionBps,
  getDefaultSlippageBps,
} from "./costs";
import { computeMetrics } from "./metrics";
import { runOutOfSampleMetrics, splitBars } from "./oos";
import { runWalkForward } from "./walkForward";
import { parseStrategyConfig } from "./schemas";
import { runSimulation } from "./runner";
import type { BacktestSimulationResult, RunBacktestInput } from "./types";
import {
  getPaperMaxBacktestDrawdownPct,
  getPaperMinBacktestReturnPct,
} from "@/lib/paper-signals/eligibility";

function strategyDisplayName(type: StrategyType): string {
  return getStrategyDisplayName(type);
}

export async function runBacktest(
  input: RunBacktestInput,
): Promise<{
  runId: string;
  result: BacktestSimulationResult;
  dataSource: string;
  warning?: string;
}> {
  if (input.endDate <= input.startDate) {
    throw new Error("endDate deve essere successiva a startDate.");
  }

  const settings = await getUserSettings();
  const initialCapital = input.initialCapital ?? settings.hypotheticalCapital;
  const commissionBps = input.commissionBps ?? getDefaultCommissionBps();
  const slippageBps = input.slippageBps ?? getDefaultSlippageBps();
  const parsedConfig = parseStrategyConfig(input.strategyType, input.config);

  const primaryAsset = await prisma.asset.findUniqueOrThrow({
    where: { id: input.assetId },
  });

  const rebalanceAssetIds =
    input.strategyType === "REBALANCE_MONTHLY"
      ? input.rebalanceAssetIds ??
        (parsedConfig as { assetIds?: string[] }).assetIds ?? [primaryAsset.id]
      : [primaryAsset.id];

  const uniqueAssetIds = [...new Set(rebalanceAssetIds)];
  const assets = await prisma.asset.findMany({
    where: { id: { in: uniqueAssetIds } },
  });

  if (assets.length === 0) {
    throw new Error("Nessun asset valido per il backtest.");
  }

  const historyByAsset = await fetchMultiAssetHistory(
    assets,
    input.startDate,
    input.endDate,
  );

  const primaryHistory = historyByAsset.get(primaryAsset.id);
  if (!primaryHistory || primaryHistory.bars.length === 0) {
    throw new Error("Serie storica non disponibile per l'asset selezionato.");
  }

  const barsByAssetId = new Map(
    [...historyByAsset.entries()].map(([id, result]) => [id, result.bars]),
  );

  const strategyDef = getStrategyDefinition(input.strategyType);
  const config = {
    ...getDefaultStrategyConfig(input.strategyType),
    ...parsedConfig,
  } as Record<string, unknown>;

  if (input.strategyType === "REBALANCE_MONTHLY") {
    const weights =
      (config.targetWeights as Record<string, number> | undefined) ?? {};
    if (Object.keys(weights).length === 0) {
      const equalWeight = 1 / uniqueAssetIds.length;
      const autoWeights: Record<string, number> = {};
      for (const assetId of uniqueAssetIds) {
        autoWeights[assetId] = equalWeight;
      }
      config.targetWeights = autoWeights;
    }
  }

  const signals = strategyDef.generateSignals(
    {
      bars: primaryHistory.bars,
      assetId: primaryAsset.id,
      assetSymbol: primaryAsset.symbol,
      initialCapital,
      extraBarsByAssetId: barsByAssetId,
    },
    config,
  );

  const simulation = runSimulation({
    primaryAsset,
    assets,
    barsByAssetId,
    signals,
    initialCapital,
    commissionBps,
    slippageBps,
  });

  const metrics = computeMetrics(
    simulation.equityCurve,
    initialCapital,
    simulation.trades.length,
    simulation.winningTrades,
    simulation.avgHoldingDays,
  );

  const { test: testBars } = splitBars(primaryHistory.bars);
  const oosMetrics = runOutOfSampleMetrics({
    primaryAsset,
    assets,
    barsByAssetId,
    testBars,
    signals,
    initialCapital,
    commissionBps,
    slippageBps,
  });

  const minOosReturn = getPaperMinBacktestReturnPct();
  const maxOosDrawdown = getPaperMaxBacktestDrawdownPct();
  const outOfSamplePassed =
    oosMetrics !== null &&
    oosMetrics.totalReturnPct >= minOosReturn &&
    oosMetrics.maxDrawdownPct <= maxOosDrawdown;

  let walkForwardPayload: ReturnType<typeof runWalkForward> | null = null;
  if (input.walkForward?.enabled) {
    const wfConfig = input.walkForward;
    walkForwardPayload = runWalkForward({
      bars: primaryHistory.bars,
      trainBars: wfConfig.trainBars,
      testBars: wfConfig.testBars,
      stepBars: wfConfig.stepBars,
      evaluateFold: (trainBars, testBars) => {
        const trainBarsMap = new Map(barsByAssetId);
        trainBarsMap.set(primaryAsset.id, trainBars);
        const trainSignals = strategyDef.generateSignals(
          {
            bars: trainBars,
            assetId: primaryAsset.id,
            assetSymbol: primaryAsset.symbol,
            initialCapital,
            extraBarsByAssetId: trainBarsMap,
          },
          config,
        );
        const trainSim = runSimulation({
          primaryAsset,
          assets,
          barsByAssetId: trainBarsMap,
          signals: trainSignals,
          initialCapital,
          commissionBps,
          slippageBps,
        });
        const isMetrics = computeMetrics(
          trainSim.equityCurve,
          initialCapital,
          trainSim.trades.length,
          trainSim.winningTrades,
          trainSim.avgHoldingDays,
        );

        const testBarsMap = new Map(barsByAssetId);
        testBarsMap.set(primaryAsset.id, testBars);
        const testSignals = strategyDef.generateSignals(
          {
            bars: testBars,
            assetId: primaryAsset.id,
            assetSymbol: primaryAsset.symbol,
            initialCapital,
            extraBarsByAssetId: testBarsMap,
          },
          config,
        );
        const testStart = testBars[0]?.date ?? "";
        const filteredTestSignals = testSignals.filter((s) => s.date >= testStart);
        const testSim = runSimulation({
          primaryAsset,
          assets,
          barsByAssetId: testBarsMap,
          signals: filteredTestSignals,
          initialCapital,
          commissionBps,
          slippageBps,
        });
        const oosFoldMetrics = computeMetrics(
          testSim.equityCurve,
          initialCapital,
          testSim.trades.length,
          testSim.winningTrades,
          testSim.avgHoldingDays,
        );

        return { inSample: isMetrics, outOfSample: oosFoldMetrics };
      },
    });
  }

  const metricsPayload = {
    ...metrics,
    outOfSample: oosMetrics,
    outOfSamplePassed,
    ...(walkForwardPayload ? { walkForward: walkForwardPayload } : {}),
  };

  const benchmark = runBuyAndHoldBenchmark(
    primaryHistory.bars,
    initialCapital,
  );

  const result: BacktestSimulationResult = {
    trades: simulation.trades,
    equityCurve: simulation.equityCurve,
    metrics,
    benchmarkMetrics: benchmark.metrics,
    finalState: simulation.finalState,
  };

  const dataSource = [...historyByAsset.values()].some(
    (h) => h.dataSource === "synthetic",
  )
    ? "synthetic"
    : primaryHistory.dataSource;

  const warning = [...historyByAsset.values()]
    .map((h) => h.warning)
    .find(Boolean);

  const presetId = `preset-${input.strategyType.toLowerCase()}`;
  const existingStrategy = await prisma.strategy.findUnique({
    where: { id: presetId },
    select: { status: true },
  });
  const preserveStatus =
    existingStrategy?.status === "PAPER_ACTIVE" ||
    existingStrategy?.status === "PROMOTED";

  const strategy = await prisma.strategy.upsert({
    where: { id: presetId },
    update: {
      name: strategyDisplayName(input.strategyType),
      type: input.strategyType,
      configJson: JSON.stringify(config),
      benchmarkSymbol: primaryAsset.symbol,
      primaryAssetId: primaryAsset.id,
      ...(preserveStatus ? {} : { status: "BACKTESTED" as const }),
    },
    create: {
      id: presetId,
      name: strategyDisplayName(input.strategyType),
      description: `Strategia predefinita ${strategyDisplayName(input.strategyType)}`,
      type: input.strategyType,
      configJson: JSON.stringify(config),
      benchmarkSymbol: primaryAsset.symbol,
      primaryAssetId: primaryAsset.id,
      status: "BACKTESTED",
    },
  });

  const run = await prisma.backtestRun.create({
    data: {
      strategyId: strategy.id,
      assetId: primaryAsset.id,
      startDate: input.startDate,
      endDate: input.endDate,
      initialCapital,
      commissionBps,
      slippageBps,
      dataSource,
      metricsJson: JSON.stringify(metricsPayload),
      benchmarkJson: JSON.stringify(benchmark.metrics),
      equityCurveJson: JSON.stringify(simulation.equityCurve),
      status: "COMPLETED",
      trades: {
        create: simulation.trades.map((trade) => ({
          date: new Date(`${trade.date}T12:00:00.000Z`),
          side: trade.side,
          quantity: trade.quantity,
          price: trade.price,
          fees: trade.fees,
          reason: trade.reason,
        })),
      },
    },
  });

  await writeAuditLog("BACKTEST_RUN", "BacktestRun", {
    backtestRunId: run.id,
    strategyType: input.strategyType,
    assetId: primaryAsset.id,
    assetSymbol: primaryAsset.symbol,
    dataSource,
    tradeCount: simulation.trades.length,
    totalReturnPct: metrics.totalReturnPct,
  });

  return {
    runId: run.id,
    result,
    dataSource,
    warning,
  };
}

export async function listBacktestRuns(limit = 20) {
  return prisma.backtestRun.findMany({
    take: limit,
    orderBy: { createdAt: "desc" },
    include: {
      strategy: true,
      asset: true,
      _count: { select: { trades: true } },
    },
  });
}

export async function getBacktestRunDetail(id: string) {
  const run = await prisma.backtestRun.findUnique({
    where: { id },
    include: {
      strategy: true,
      asset: true,
      trades: { orderBy: { date: "asc" } },
    },
  });

  if (!run) return null;

  return {
    ...run,
    metrics: JSON.parse(run.metricsJson),
    benchmark: run.benchmarkJson ? JSON.parse(run.benchmarkJson) : null,
    equityCurve: JSON.parse(run.equityCurveJson),
  };
}

export {
  analyzeOverfit,
  computeDegradation,
  computeConsistency,
  computeFoldStability,
  analyzeParameterSensitivity,
  getOverfitRecommendationLabel,
} from "./overfit";
export type { OverfitAnalysis } from "./overfit";
