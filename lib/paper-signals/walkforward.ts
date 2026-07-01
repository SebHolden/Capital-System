import type { Asset, Strategy } from "@prisma/client";
import { prisma } from "@/lib/db";
import { fetchPriceHistory } from "@/lib/prices/history";
import { validateDataQuality } from "@/lib/data-quality";
import { isCryptoAsset } from "@/lib/prices/symbols";
import {
  runWalkForward,
  type WalkForwardResult,
} from "@/lib/backtesting/walkForward";
import { computeMetrics } from "@/lib/backtesting/metrics";
import { runSimulation } from "@/lib/backtesting/runner";
import { getStrategyDefinition, getDefaultStrategyConfig } from "@/lib/strategies";

export interface WalkForwardValidationResult {
  strategyId: string;
  assetId: string;
  validatedAt: Date;
  walkForwardScore: number;
  overfitScore: number;
  foldCount: number;
  avgInSampleReturn: number;
  avgOutOfSampleReturn: number;
  avgInSampleDrawdown: number;
  avgOutOfSampleDrawdown: number;
  dataQualityScore: number;
  passed: boolean;
  warnings: string[];
}

export function getWalkForwardMinScore(): number {
  const raw = process.env.WALKFORWARD_MIN_SCORE;
  const parsed = raw ? parseFloat(raw) : 0.6;
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 1 ? parsed : 0.6;
}

export function getWalkForwardTrainBars(): number {
  const raw = process.env.WALKFORWARD_TRAIN_BARS;
  const parsed = raw ? parseInt(raw, 10) : 180;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 180;
}

export function getWalkForwardTestBars(): number {
  const raw = process.env.WALKFORWARD_TEST_BARS;
  const parsed = raw ? parseInt(raw, 10) : 60;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 60;
}

export function getWalkForwardStepBars(): number {
  const raw = process.env.WALKFORWARD_STEP_BARS;
  const parsed = raw ? parseInt(raw, 10) : 30;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 30;
}

export function computeWalkForwardScore(result: WalkForwardResult): number {
  if (!result.aggregate || result.folds.length === 0) return 0;

  const { avgInSampleReturnPct, avgOutOfSampleReturnPct } = result.aggregate;

  if (avgInSampleReturnPct <= 0) return 0;
  if (avgOutOfSampleReturnPct <= 0) return 0;

  const ratio = avgOutOfSampleReturnPct / avgInSampleReturnPct;
  return Math.min(1, Math.max(0, ratio));
}

export function computeOverfitScore(result: WalkForwardResult): number {
  if (!result.aggregate || result.folds.length === 0) return 1;

  const { avgInSampleReturnPct, avgOutOfSampleReturnPct } = result.aggregate;

  if (avgInSampleReturnPct <= 0) return 0;

  const degradation =
    (avgInSampleReturnPct - avgOutOfSampleReturnPct) / avgInSampleReturnPct;

  return Math.max(0, Math.min(1, degradation));
}

export async function runWalkForwardValidation(
  strategy: Strategy,
  asset: Asset,
  lookbackYears: number = 2,
): Promise<WalkForwardValidationResult> {
  const now = new Date();
  const warnings: string[] = [];

  const from = new Date(now);
  from.setFullYear(from.getFullYear() - lookbackYears);

  const history = await fetchPriceHistory(asset, from, now);

  const isCrypto = isCryptoAsset(asset.assetType);
  const dataQuality = validateDataQuality(history, asset.id, from, now, isCrypto);

  if (!dataQuality.isSufficientForEvaluation) {
    warnings.push(...dataQuality.warnings);
  }

  const trainBars = getWalkForwardTrainBars();
  const testBars = getWalkForwardTestBars();
  const stepBars = getWalkForwardStepBars();

  const minRequiredBars = trainBars + testBars + stepBars;
  if (history.bars.length < minRequiredBars) {
    return {
      strategyId: strategy.id,
      assetId: asset.id,
      validatedAt: now,
      walkForwardScore: 0,
      overfitScore: 1,
      foldCount: 0,
      avgInSampleReturn: 0,
      avgOutOfSampleReturn: 0,
      avgInSampleDrawdown: 0,
      avgOutOfSampleDrawdown: 0,
      dataQualityScore: dataQuality.qualityScore,
      passed: false,
      warnings: [
        `Insufficienti barre per walk-forward: ${history.bars.length}/${minRequiredBars}`,
        ...warnings,
      ],
    };
  }

  const strategyDef = getStrategyDefinition(strategy.type);
  const config = {
    ...getDefaultStrategyConfig(strategy.type),
    ...(strategy.configJson ? JSON.parse(strategy.configJson) : {}),
  } as Record<string, unknown>;

  const barsByAssetId = new Map([[asset.id, history.bars]]);
  const initialCapital = 10000;
  const commissionBps = 10;
  const slippageBps = 10;

  const wfResult = runWalkForward({
    bars: history.bars,
    trainBars,
    testBars,
    stepBars,
    evaluateFold: (trainSlice, testSlice) => {
      const trainBarsMap = new Map(barsByAssetId);
      trainBarsMap.set(asset.id, trainSlice);
      const trainSignals = strategyDef.generateSignals(
        {
          bars: trainSlice,
          assetId: asset.id,
          assetSymbol: asset.symbol,
          initialCapital,
          extraBarsByAssetId: trainBarsMap,
        },
        config,
      );
      const trainSim = runSimulation({
        primaryAsset: asset,
        assets: [asset],
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
      testBarsMap.set(asset.id, testSlice);
      const testSignals = strategyDef.generateSignals(
        {
          bars: testSlice,
          assetId: asset.id,
          assetSymbol: asset.symbol,
          initialCapital,
          extraBarsByAssetId: testBarsMap,
        },
        config,
      );
      const testStart = testSlice[0]?.date ?? "";
      const filteredTestSignals = testSignals.filter((s) => s.date >= testStart);
      const testSim = runSimulation({
        primaryAsset: asset,
        assets: [asset],
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

  const wfScore = computeWalkForwardScore(wfResult);
  const overfitScore = computeOverfitScore(wfResult);
  const minScore = getWalkForwardMinScore();

  if (wfScore < minScore) {
    warnings.push(
      `Walk-forward score ${(wfScore * 100).toFixed(0)}% sotto soglia ${(minScore * 100).toFixed(0)}%.`,
    );
  }

  if (overfitScore > 0.5) {
    warnings.push(
      `Possibile overfitting: degradazione IS→OOS ${(overfitScore * 100).toFixed(0)}%.`,
    );
  }

  const passed =
    wfScore >= minScore &&
    overfitScore <= 0.5 &&
    dataQuality.isSufficientForEvaluation;

  return {
    strategyId: strategy.id,
    assetId: asset.id,
    validatedAt: now,
    walkForwardScore: wfScore,
    overfitScore,
    foldCount: wfResult.folds.length,
    avgInSampleReturn: wfResult.aggregate?.avgInSampleReturnPct ?? 0,
    avgOutOfSampleReturn: wfResult.aggregate?.avgOutOfSampleReturnPct ?? 0,
    avgInSampleDrawdown: wfResult.aggregate?.avgInSampleMaxDrawdownPct ?? 0,
    avgOutOfSampleDrawdown: wfResult.aggregate?.avgOutOfSampleMaxDrawdownPct ?? 0,
    dataQualityScore: dataQuality.qualityScore,
    passed,
    warnings,
  };
}

export async function validateStrategyForPaper(
  strategyId: string,
): Promise<WalkForwardValidationResult | null> {
  const strategy = await prisma.strategy.findUnique({
    where: { id: strategyId },
    include: { primaryAsset: true },
  });

  if (!strategy || !strategy.primaryAsset) {
    return null;
  }

  const result = await runWalkForwardValidation(strategy, strategy.primaryAsset);

  await prisma.strategy.update({
    where: { id: strategyId },
    data: {
      walkForwardValidatedAt: result.validatedAt,
      walkForwardScore: result.walkForwardScore,
      overfitScore: result.overfitScore,
    },
  });

  return result;
}

export async function getStrategiesNeedingValidation(): Promise<Strategy[]> {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  return prisma.strategy.findMany({
    where: {
      status: { in: ["BACKTESTED", "PAPER_ACTIVE"] },
      OR: [
        { walkForwardValidatedAt: null },
        { walkForwardValidatedAt: { lt: thirtyDaysAgo } },
      ],
    },
  });
}
