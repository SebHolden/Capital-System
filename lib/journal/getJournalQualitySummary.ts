import type { PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "@/lib/db";
import { scoreJournal } from "./scoreJournal";
import type { JournalInput } from "./types";

function toJournalInput(journal: {
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
}): JournalInput {
  return {
    title: journal.title,
    thesis: journal.thesis,
    risks: journal.risks,
    invalidation: journal.invalidation,
    emotionalState: journal.emotionalState,
    timeHorizon: journal.timeHorizon,
    maxAcceptableLoss: journal.maxAcceptableLoss,
    exitRule: journal.exitRule,
    emotionScore: journal.emotionScore,
    confidenceScore: journal.confidenceScore,
    planned: journal.planned,
  };
}

export interface JournalQualitySummary {
  total: number;
  completeCount: number;
  completePct: number;
  avgEmotionScore: number;
  avgConfidenceScore: number;
  plannedPct: number;
  levelCounts: { GREEN: number; YELLOW: number; ORANGE: number; RED: number };
  avgQualityScore: number;
  unlinkedCount: number;
  recentJournals: Array<{
    id: string;
    title: string;
    qualityScore: number;
    level: string;
    isComplete: boolean;
    createdAt: Date;
  }>;
}

export interface JournalQualityOptions {
  since?: Date;
  until?: Date;
}

export async function getJournalQualitySummary(
  client: PrismaClient = defaultPrisma,
  options?: JournalQualityOptions,
): Promise<JournalQualitySummary> {
  const until = options?.until ?? new Date();
  const since =
    options?.since ??
    new Date(until.getTime() - 30 * 24 * 60 * 60 * 1000);

  const journals = await client.tradeJournal.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { orderIntents: true } } },
  });

  const recent = journals.filter(
    (j) => j.createdAt >= since && j.createdAt <= until,
  );

  const levelCounts = { GREEN: 0, YELLOW: 0, ORANGE: 0, RED: 0 };
  let emotionSum = 0;
  let confidenceSum = 0;
  let plannedCount = 0;
  let qualitySum = 0;

  for (const journal of recent) {
    const scored = scoreJournal(toJournalInput(journal));
    if (scored.level in levelCounts) {
      levelCounts[scored.level as keyof typeof levelCounts]++;
    }
    emotionSum += journal.emotionScore;
    confidenceSum += journal.confidenceScore;
    qualitySum += journal.qualityScore || scored.qualityScore;
    if (journal.planned) plannedCount++;
  }

  const recentCount = recent.length;
  const completeCount = journals.filter((j) => j.isComplete).length;

  return {
    total: journals.length,
    completeCount,
    completePct:
      journals.length > 0 ? (completeCount / journals.length) * 100 : 0,
    avgEmotionScore: recentCount > 0 ? emotionSum / recentCount : 0,
    avgConfidenceScore: recentCount > 0 ? confidenceSum / recentCount : 0,
    plannedPct: recentCount > 0 ? (plannedCount / recentCount) * 100 : 0,
    levelCounts,
    avgQualityScore: recentCount > 0 ? qualitySum / recentCount : 0,
    unlinkedCount: journals.filter((j) => j._count.orderIntents === 0).length,
    recentJournals: journals.slice(0, 5).map((j) => {
      const scored = scoreJournal(toJournalInput(j));
      return {
        id: j.id,
        title: j.title,
        qualityScore: j.qualityScore || scored.qualityScore,
        level: scored.level,
        isComplete: j.isComplete,
        createdAt: j.createdAt,
      };
    }),
  };
}
