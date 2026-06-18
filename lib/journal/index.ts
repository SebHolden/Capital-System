import type { JournalInput } from "./types";
import { scoreJournal } from "./scoreJournal";

export type { JournalInput, JournalScoreResult } from "./types";
export {
  computeIsComplete,
  MIN_THESIS_LENGTH,
  MIN_TEXT_LENGTH,
  MIN_EXIT_RULE_LENGTH,
  MIN_TIME_HORIZON_LENGTH,
  RECOMMENDED_TEXT_LENGTH,
} from "./completeness";
export { scoreJournal } from "./scoreJournal";
export {
  getJournalQualitySummary,
  type JournalQualitySummary,
} from "./getJournalQualitySummary";
export {
  isJournalEligibleForOrder,
  rescoreAllJournals,
  toJournalInput,
} from "./eligibility";

export function applyJournalScoring(input: JournalInput) {
  const scored = scoreJournal(input);
  return {
    ...input,
    isComplete: scored.isComplete,
    qualityScore: scored.qualityScore,
  };
}
