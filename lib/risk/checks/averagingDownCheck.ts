import type { RiskCheckResult } from "./types";

export function evaluateAveragingDownCheck(input: {
  side: "BUY" | "SELL";
  rejectAveragingDown: boolean;
  limitPrice: number;
  positionAvgPrice?: number;
  hasPosition: boolean;
}): RiskCheckResult {
  if (
    !input.rejectAveragingDown ||
    input.side !== "BUY" ||
    !input.hasPosition ||
    input.positionAvgPrice === undefined
  ) {
    return { reasons: [], warnings: [], block: false };
  }

  if (input.limitPrice < input.positionAvgPrice) {
    return {
      reasons: [
        `Averaging down bloccato: prezzo ordine (€${input.limitPrice.toFixed(2)}) sotto prezzo medio (€${input.positionAvgPrice.toFixed(2)}).`,
      ],
      warnings: [],
      block: true,
    };
  }

  return { reasons: [], warnings: [], block: false };
}
