export interface DataGap {
  startDate: string;
  endDate: string;
  missingDays: number;
}

export interface DataOutlier {
  date: string;
  value: number;
  zScore: number;
  direction: "high" | "low";
}

export interface DataQualityReport {
  assetId: string;
  fromDate: string;
  toDate: string;
  expectedDays: number;
  actualDays: number;
  completenessRatio: number;
  gaps: DataGap[];
  outliers: DataOutlier[];
  dataSource: "coingecko" | "finnhub" | "synthetic" | "database";
  qualityScore: number;
  warnings: string[];
  isSufficientForEvaluation: boolean;
}

export interface DataQualityThresholds {
  minCompleteness: number;
  maxGapDays: number;
  maxOutlierZScore: number;
  minBarsForEvaluation: number;
  minQualityScore: number;
}

export const DEFAULT_DATA_QUALITY_THRESHOLDS: DataQualityThresholds = {
  minCompleteness: 0.9,
  maxGapDays: 5,
  maxOutlierZScore: 3.5,
  minBarsForEvaluation: 30,
  minQualityScore: 60,
};

export type DataQualityLevel = "EXCELLENT" | "GOOD" | "ACCEPTABLE" | "POOR" | "INSUFFICIENT";

export function qualityScoreToLevel(score: number): DataQualityLevel {
  if (score >= 90) return "EXCELLENT";
  if (score >= 75) return "GOOD";
  if (score >= 60) return "ACCEPTABLE";
  if (score >= 40) return "POOR";
  return "INSUFFICIENT";
}
