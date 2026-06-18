import type { RiskLevel } from "@prisma/client";
import {
  computeIsComplete,
  MIN_EXIT_RULE_LENGTH,
  MIN_TEXT_LENGTH,
  MIN_THESIS_LENGTH,
  MIN_TIME_HORIZON_LENGTH,
  RECOMMENDED_TEXT_LENGTH,
} from "./completeness";
import type { JournalInput, JournalScoreResult } from "./types";

function textPenalty(length: number, recommended = RECOMMENDED_TEXT_LENGTH): number {
  if (length < MIN_TEXT_LENGTH) return 25;
  if (length < recommended) return 10;
  return 0;
}

export function scoreJournal(journal: JournalInput): JournalScoreResult {
  const reasons: string[] = [];
  const warnings: string[] = [];
  let score = 100;

  if (!journal.title.trim()) {
    reasons.push("Campo journal mancante: title.");
  }
  if (journal.thesis.trim().length < MIN_THESIS_LENGTH) {
    reasons.push("Tesi troppo breve o mancante.");
  }
  if (journal.risks.trim().length < MIN_TEXT_LENGTH) {
    reasons.push("Rischi troppo brevi o mancanti.");
  }
  if (journal.invalidation.trim().length < MIN_TEXT_LENGTH) {
    reasons.push("Invalidazione troppo breve o mancante.");
  }
  if (journal.timeHorizon.trim().length < MIN_TIME_HORIZON_LENGTH) {
    reasons.push("Orizzonte temporale mancante.");
  }
  if (journal.exitRule.trim().length < MIN_EXIT_RULE_LENGTH) {
    reasons.push("Regola di uscita mancante o troppo breve.");
  }
  if (journal.maxAcceptableLoss <= 0) {
    reasons.push("Perdita massima accettabile non valida.");
  }
  if (journal.emotionalState.trim().length < 3) {
    reasons.push("Stato emotivo (testo) mancante.");
  }

  const isComplete = computeIsComplete(journal);

  score -= textPenalty(journal.thesis.trim().length);
  score -= textPenalty(journal.risks.trim().length);
  score -= textPenalty(journal.invalidation.trim().length);
  score -= textPenalty(journal.exitRule.trim().length);

  if (journal.thesis.trim().length < RECOMMENDED_TEXT_LENGTH) {
    warnings.push("Tesi breve: espandi il ragionamento.");
  }
  if (journal.risks.trim().length < RECOMMENDED_TEXT_LENGTH) {
    warnings.push("Sezione rischi breve.");
  }
  if (journal.invalidation.trim().length < RECOMMENDED_TEXT_LENGTH) {
    warnings.push("Condizioni di invalidazione brevi.");
  }
  if (journal.exitRule.trim().length < RECOMMENDED_TEXT_LENGTH) {
    warnings.push("Regola di uscita breve.");
  }

  if (journal.emotionScore >= 8) {
    reasons.push(
      `Emotion score elevato (${journal.emotionScore}/10): possibile decisione impulsiva.`,
    );
    score -= 40;
  } else if (journal.emotionScore >= 6) {
    warnings.push(
      `Emotion score moderato (${journal.emotionScore}/10): procedi con cautela.`,
    );
    score -= 15;
  } else {
    score -= Math.max(0, journal.emotionScore - 1) * 2;
  }

  if (journal.confidenceScore <= 3) {
    warnings.push(
      `Confidence score basso (${journal.confidenceScore}/10).`,
    );
    score -= 20;
  } else {
    score -= Math.max(0, 5 - journal.confidenceScore) * 3;
  }

  if (!journal.planned) {
    warnings.push("Trade non pianificato: rischio impulsività.");
    score -= 15;
  }

  score = Math.max(0, Math.min(100, Math.round(score)));

  let level: RiskLevel = "GREEN";

  if (!isComplete || journal.emotionScore >= 8) {
    level = "RED";
  } else if (
    journal.emotionScore >= 6 ||
    journal.confidenceScore <= 3 ||
    !journal.planned ||
    warnings.some((w) => w.includes("breve"))
  ) {
    level = "YELLOW";
  }

  if (!isComplete && level !== "RED") {
    level = "RED";
  }

  return {
    qualityScore: score,
    level,
    reasons,
    warnings,
    isComplete,
  };
}
