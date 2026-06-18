import type { RiskLevel } from "@prisma/client";

export interface JournalInput {
  title: string;
  thesis: string;
  risks: string;
  invalidation: string;
  emotionalState: string;
  timeHorizon: string;
  maxAcceptableLoss: number;
  exitRule: string;
  emotionScore: number;
  confidenceScore: number;
  planned: boolean;
}

export interface JournalScoreResult {
  qualityScore: number;
  level: RiskLevel;
  reasons: string[];
  warnings: string[];
  isComplete: boolean;
}
