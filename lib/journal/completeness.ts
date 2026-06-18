import type { JournalInput } from "./types";

export const MIN_THESIS_LENGTH = 10;
export const MIN_TEXT_LENGTH = 10;
export const MIN_EXIT_RULE_LENGTH = 5;
export const MIN_TIME_HORIZON_LENGTH = 3;
export const RECOMMENDED_TEXT_LENGTH = 30;

export function computeIsComplete(journal: JournalInput): boolean {
  return (
    journal.title.trim().length > 0 &&
    journal.thesis.trim().length >= MIN_THESIS_LENGTH &&
    journal.risks.trim().length >= MIN_TEXT_LENGTH &&
    journal.invalidation.trim().length >= MIN_TEXT_LENGTH &&
    journal.emotionalState.trim().length >= 3 &&
    journal.timeHorizon.trim().length >= MIN_TIME_HORIZON_LENGTH &&
    journal.exitRule.trim().length >= MIN_EXIT_RULE_LENGTH &&
    journal.maxAcceptableLoss > 0 &&
    journal.emotionScore >= 1 &&
    journal.emotionScore <= 10 &&
    journal.confidenceScore >= 1 &&
    journal.confidenceScore <= 10
  );
}
