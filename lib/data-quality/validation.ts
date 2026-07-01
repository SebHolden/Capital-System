import type { PriceBar, PriceHistoryResult } from "@/lib/prices/history";
import type {
  DataGap,
  DataOutlier,
  DataQualityReport,
  DataQualityThresholds,
} from "./types";
import { DEFAULT_DATA_QUALITY_THRESHOLDS } from "./types";

function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function isWeekend(dateStr: string): boolean {
  const date = new Date(`${dateStr}T12:00:00Z`);
  const day = date.getUTCDay();
  return day === 0 || day === 6;
}

function countExpectedTradingDays(from: string, to: string, includeWeekends: boolean): number {
  const start = new Date(`${from}T12:00:00Z`);
  const end = new Date(`${to}T12:00:00Z`);
  let count = 0;
  const cursor = new Date(start);
  
  while (cursor <= end) {
    const dateStr = toDateKey(cursor);
    if (includeWeekends || !isWeekend(dateStr)) {
      count++;
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  
  return count;
}

export function detectGaps(
  bars: PriceBar[],
  maxGapDays: number = DEFAULT_DATA_QUALITY_THRESHOLDS.maxGapDays,
  isCrypto: boolean = false,
): DataGap[] {
  if (bars.length < 2) return [];
  
  const gaps: DataGap[] = [];
  const sortedBars = [...bars].sort((a, b) => a.date.localeCompare(b.date));
  
  for (let i = 1; i < sortedBars.length; i++) {
    const prevDate = new Date(`${sortedBars[i - 1].date}T12:00:00Z`);
    const currDate = new Date(`${sortedBars[i].date}T12:00:00Z`);
    
    const diffMs = currDate.getTime() - prevDate.getTime();
    const diffDays = Math.round(diffMs / (24 * 60 * 60 * 1000));
    
    const expectedDiff = isCrypto ? 1 : 3;
    
    if (diffDays > expectedDiff) {
      let missingDays = diffDays - 1;
      
      if (!isCrypto) {
        let weekendDays = 0;
        const cursor = new Date(prevDate);
        cursor.setUTCDate(cursor.getUTCDate() + 1);
        while (cursor < currDate) {
          if (isWeekend(toDateKey(cursor))) {
            weekendDays++;
          }
          cursor.setUTCDate(cursor.getUTCDate() + 1);
        }
        missingDays -= weekendDays;
      }
      
      if (missingDays > 0) {
        const gapStart = new Date(prevDate);
        gapStart.setUTCDate(gapStart.getUTCDate() + 1);
        const gapEnd = new Date(currDate);
        gapEnd.setUTCDate(gapEnd.getUTCDate() - 1);
        
        gaps.push({
          startDate: toDateKey(gapStart),
          endDate: toDateKey(gapEnd),
          missingDays,
        });
      }
    }
  }
  
  return gaps.filter(g => g.missingDays > maxGapDays);
}

export function detectOutliers(
  bars: PriceBar[],
  zScoreThreshold: number = DEFAULT_DATA_QUALITY_THRESHOLDS.maxOutlierZScore,
): DataOutlier[] {
  if (bars.length < 10) return [];
  
  const returns: { date: string; value: number; returnPct: number }[] = [];
  const sortedBars = [...bars].sort((a, b) => a.date.localeCompare(b.date));
  
  for (let i = 1; i < sortedBars.length; i++) {
    const prev = sortedBars[i - 1].close;
    const curr = sortedBars[i].close;
    if (prev > 0) {
      const returnPct = ((curr - prev) / prev) * 100;
      returns.push({ date: sortedBars[i].date, value: curr, returnPct });
    }
  }
  
  if (returns.length < 5) return [];
  
  const mean = returns.reduce((sum, r) => sum + r.returnPct, 0) / returns.length;
  const variance = returns.reduce((sum, r) => sum + Math.pow(r.returnPct - mean, 2), 0) / returns.length;
  const stdDev = Math.sqrt(variance);
  
  if (stdDev === 0) return [];
  
  const outliers: DataOutlier[] = [];
  for (const r of returns) {
    const zScore = (r.returnPct - mean) / stdDev;
    if (Math.abs(zScore) > zScoreThreshold) {
      outliers.push({
        date: r.date,
        value: r.value,
        zScore: Math.abs(zScore),
        direction: zScore > 0 ? "high" : "low",
      });
    }
  }
  
  return outliers;
}

export function computeCompleteness(
  bars: PriceBar[],
  from: string,
  to: string,
  isCrypto: boolean = false,
): number {
  const expectedDays = countExpectedTradingDays(from, to, isCrypto);
  if (expectedDays === 0) return 0;
  
  const uniqueDates = new Set(bars.map(b => b.date));
  return uniqueDates.size / expectedDays;
}

export function computeQualityScore(
  completeness: number,
  gaps: DataGap[],
  outliers: DataOutlier[],
  dataSource: string,
  barCount: number,
  thresholds: DataQualityThresholds = DEFAULT_DATA_QUALITY_THRESHOLDS,
): number {
  let score = 100;
  
  if (dataSource === "synthetic") {
    score -= 50;
  }
  
  const completenessScore = completeness * 30;
  score -= (30 - completenessScore);
  
  const largeGaps = gaps.filter(g => g.missingDays > thresholds.maxGapDays);
  score -= largeGaps.length * 5;
  
  score -= outliers.length * 2;
  
  if (barCount < thresholds.minBarsForEvaluation) {
    const barPenalty = (thresholds.minBarsForEvaluation - barCount) * 0.5;
    score -= Math.min(barPenalty, 20);
  }
  
  return Math.max(0, Math.min(100, Math.round(score)));
}

export function validateDataQuality(
  historyResult: PriceHistoryResult,
  assetId: string,
  from: Date,
  to: Date,
  isCrypto: boolean = false,
  thresholds: DataQualityThresholds = DEFAULT_DATA_QUALITY_THRESHOLDS,
): DataQualityReport {
  const fromDate = toDateKey(from);
  const toDate = toDateKey(to);
  const bars = historyResult.bars;
  
  const gaps = detectGaps(bars, 0, isCrypto);
  const outliers = detectOutliers(bars, thresholds.maxOutlierZScore);
  const completeness = computeCompleteness(bars, fromDate, toDate, isCrypto);
  
  const qualityScore = computeQualityScore(
    completeness,
    gaps,
    outliers,
    historyResult.dataSource,
    bars.length,
    thresholds,
  );
  
  const warnings: string[] = [];
  
  if (historyResult.dataSource === "synthetic") {
    warnings.push("Dati sintetici: valutazione non affidabile.");
  }
  
  if (completeness < thresholds.minCompleteness) {
    warnings.push(`Completezza dati bassa: ${(completeness * 100).toFixed(1)}%.`);
  }
  
  const significantGaps = gaps.filter(g => g.missingDays > thresholds.maxGapDays);
  if (significantGaps.length > 0) {
    warnings.push(`Rilevati ${significantGaps.length} gap significativi nei dati.`);
  }
  
  if (outliers.length > 5) {
    warnings.push(`Rilevati ${outliers.length} valori anomali.`);
  }
  
  if (bars.length < thresholds.minBarsForEvaluation) {
    warnings.push(`Insufficienti barre dati: ${bars.length}/${thresholds.minBarsForEvaluation}.`);
  }
  
  const isSufficientForEvaluation =
    qualityScore >= thresholds.minQualityScore &&
    bars.length >= thresholds.minBarsForEvaluation &&
    historyResult.dataSource !== "synthetic";
  
  return {
    assetId,
    fromDate,
    toDate,
    expectedDays: countExpectedTradingDays(fromDate, toDate, isCrypto),
    actualDays: bars.length,
    completenessRatio: completeness,
    gaps: significantGaps,
    outliers,
    dataSource: historyResult.dataSource,
    qualityScore,
    warnings,
    isSufficientForEvaluation,
  };
}

export function getMinDataQualityScore(): number {
  const raw = process.env.MIN_DATA_QUALITY_SCORE;
  const parsed = raw ? parseInt(raw, 10) : 60;
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 100 ? parsed : 60;
}

export function getMinBarsForEvaluation(): number {
  const raw = process.env.MIN_BARS_FOR_EVALUATION;
  const parsed = raw ? parseInt(raw, 10) : 30;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 30;
}
