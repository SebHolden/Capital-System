import type { RiskLevel } from "./types";

export function computeRiskScore(input: {
  riskLevel: RiskLevel;
  drawdownPct: number;
  maxDrawdownPct: number;
  maxPositionPct: number;
  topPositionPct: number;
  journalQualityAvg: number;
  hasUntrustedPrices?: boolean;
  untrustedPricePct?: number;
}): number {
  const levelPenalty: Record<RiskLevel, number> = {
    GREEN: 0,
    YELLOW: 12,
    ORANGE: 28,
    RED: 55,
    BLACK: 90,
  };

  let score = levelPenalty[input.riskLevel];

  const drawdownRatio =
    input.maxDrawdownPct > 0
      ? input.drawdownPct / input.maxDrawdownPct
      : 0;
  score += Math.min(25, drawdownRatio * 25);

  const concentrationRatio =
    input.maxPositionPct > 0
      ? input.topPositionPct / input.maxPositionPct
      : 0;
  score += Math.min(20, concentrationRatio * 20);

  const journalPenalty = Math.max(0, 70 - input.journalQualityAvg);
  score += journalPenalty * 0.15;

  if (input.hasUntrustedPrices) {
    score += 10;
  }

  if ((input.untrustedPricePct ?? 0) >= 15) {
    score += 20;
  }

  if ((input.untrustedPricePct ?? 0) >= 25) {
    score = Math.max(score, 80);
  }

  return Math.round(Math.min(100, Math.max(0, score)));
}

export function riskScoreLabel(score: number): string {
  if (score <= 25) return "Basso";
  if (score <= 50) return "Moderato";
  if (score <= 75) return "Elevato";
  return "Critico";
}
