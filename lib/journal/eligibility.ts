import type { PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "@/lib/db";
import { scoreJournal } from "./scoreJournal";
import type { JournalInput } from "./types";

export function toJournalInput(journal: {
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

export function isJournalEligibleForOrder(
  journal: JournalInput & { isComplete: boolean },
): boolean {
  const scored = scoreJournal(toJournalInput(journal));
  return (
    scored.isComplete &&
    journal.isComplete &&
    scored.level !== "RED" &&
    journal.emotionScore < 8
  );
}

export async function rescoreAllJournals(
  client: PrismaClient = defaultPrisma,
): Promise<number> {
  const journals = await client.tradeJournal.findMany();
  let updated = 0;

  for (const journal of journals) {
    const scored = scoreJournal(toJournalInput(journal));
    await client.tradeJournal.update({
      where: { id: journal.id },
      data: {
        isComplete: scored.isComplete,
        qualityScore: scored.qualityScore,
      },
    });
    updated++;
  }

  return updated;
}
