import type { PerformanceMetrics } from "./types";
import type { WalkForwardResult, WalkForwardFold } from "./walkForward";

export interface OverfitAnalysis {
  overfitScore: number;
  degradationPct: number;
  consistencyScore: number;
  foldStability: number;
  warnings: string[];
  recommendation: "SAFE" | "CAUTION" | "HIGH_RISK" | "REJECT";
}

export function computeDegradation(
  inSampleReturn: number,
  outOfSampleReturn: number,
): number {
  if (inSampleReturn <= 0) return 0;
  const degradation = (inSampleReturn - outOfSampleReturn) / inSampleReturn;
  return Math.max(0, Math.min(1, degradation));
}

export function computeConsistency(folds: WalkForwardFold[]): number {
  if (folds.length < 2) return 0;

  const oosReturns = folds.map((f) => f.outOfSample.totalReturnPct);
  const mean = oosReturns.reduce((a, b) => a + b, 0) / oosReturns.length;

  if (mean === 0) return 0;

  const variance =
    oosReturns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) /
    oosReturns.length;
  const stdDev = Math.sqrt(variance);

  const cv = stdDev / Math.abs(mean);

  const consistency = Math.max(0, 1 - cv / 2);
  return Math.min(1, consistency);
}

export function computeFoldStability(folds: WalkForwardFold[]): number {
  if (folds.length === 0) return 0;

  const positiveOos = folds.filter(
    (f) => f.outOfSample.totalReturnPct > 0,
  ).length;

  return positiveOos / folds.length;
}

export function analyzeOverfit(
  walkForwardResult: WalkForwardResult,
): OverfitAnalysis {
  const warnings: string[] = [];

  if (!walkForwardResult.aggregate || walkForwardResult.folds.length === 0) {
    return {
      overfitScore: 1,
      degradationPct: 100,
      consistencyScore: 0,
      foldStability: 0,
      warnings: ["Dati walk-forward insufficienti per analisi overfit."],
      recommendation: "REJECT",
    };
  }

  const { avgInSampleReturnPct, avgOutOfSampleReturnPct } =
    walkForwardResult.aggregate;

  const degradationPct = computeDegradation(
    avgInSampleReturnPct,
    avgOutOfSampleReturnPct,
  ) * 100;

  const consistencyScore = computeConsistency(walkForwardResult.folds);
  const foldStability = computeFoldStability(walkForwardResult.folds);

  const overfitScore =
    degradationPct / 100 * 0.5 +
    (1 - consistencyScore) * 0.3 +
    (1 - foldStability) * 0.2;

  if (degradationPct > 50) {
    warnings.push(
      `Forte degradazione IS→OOS: ${degradationPct.toFixed(0)}%. Possibile overfitting.`,
    );
  } else if (degradationPct > 30) {
    warnings.push(
      `Degradazione moderata IS→OOS: ${degradationPct.toFixed(0)}%.`,
    );
  }

  if (consistencyScore < 0.5) {
    warnings.push(
      `Bassa consistenza tra fold: ${(consistencyScore * 100).toFixed(0)}%.`,
    );
  }

  if (foldStability < 0.5) {
    warnings.push(
      `Meno del 50% dei fold ha rendimento OOS positivo.`,
    );
  }

  if (avgOutOfSampleReturnPct < 0) {
    warnings.push(
      `Rendimento OOS medio negativo: ${avgOutOfSampleReturnPct.toFixed(2)}%.`,
    );
  }

  let recommendation: OverfitAnalysis["recommendation"];
  if (overfitScore <= 0.25 && foldStability >= 0.6) {
    recommendation = "SAFE";
  } else if (overfitScore <= 0.4 && foldStability >= 0.4) {
    recommendation = "CAUTION";
  } else if (overfitScore <= 0.6) {
    recommendation = "HIGH_RISK";
  } else {
    recommendation = "REJECT";
  }

  return {
    overfitScore: Math.min(1, Math.max(0, overfitScore)),
    degradationPct,
    consistencyScore,
    foldStability,
    warnings,
    recommendation,
  };
}

export function analyzeParameterSensitivity(
  baseMetrics: PerformanceMetrics,
  perturbedMetrics: PerformanceMetrics[],
): {
  sensitivityScore: number;
  maxDeviation: number;
  warnings: string[];
} {
  if (perturbedMetrics.length === 0) {
    return { sensitivityScore: 0, maxDeviation: 0, warnings: [] };
  }

  const baseReturn = baseMetrics.totalReturnPct;
  const warnings: string[] = [];

  const deviations = perturbedMetrics.map((m) => {
    if (baseReturn === 0) return Math.abs(m.totalReturnPct);
    return Math.abs((m.totalReturnPct - baseReturn) / baseReturn);
  });

  const maxDeviation = Math.max(...deviations);
  const avgDeviation =
    deviations.reduce((a, b) => a + b, 0) / deviations.length;

  const sensitivityScore = Math.min(1, avgDeviation);

  if (maxDeviation > 0.5) {
    warnings.push(
      `Alta sensibilità parametri: deviazione max ${(maxDeviation * 100).toFixed(0)}%.`,
    );
  }

  if (sensitivityScore > 0.3) {
    warnings.push(
      `Rendimento instabile con variazioni parametri.`,
    );
  }

  return {
    sensitivityScore,
    maxDeviation,
    warnings,
  };
}

export function getOverfitRecommendationLabel(
  recommendation: OverfitAnalysis["recommendation"],
): string {
  switch (recommendation) {
    case "SAFE":
      return "Basso rischio overfitting";
    case "CAUTION":
      return "Rischio moderato";
    case "HIGH_RISK":
      return "Alto rischio overfitting";
    case "REJECT":
      return "Probabile overfitting";
  }
}
