import type { OrderContext } from "../types";
import type { RiskCheckResult } from "./types";

export function evaluateCashReserveCheck(context: OrderContext): RiskCheckResult {
  const reasons: string[] = [];

  if (context.side === "BUY" && context.orderAmount > context.cashBalance) {
    reasons.push(
      `Liquidità insufficiente: disponibile €${context.cashBalance.toFixed(2)}, richiesto €${context.orderAmount.toFixed(2)}.`,
    );
  }

  if (
    context.side === "BUY" &&
    context.bucket === "SPECULATIVE" &&
    context.orderAmount > context.experimentalCashBalance
  ) {
    reasons.push(
      `Liquidità sperimentale insufficiente: disponibile €${context.experimentalCashBalance.toFixed(2)}, richiesto €${context.orderAmount.toFixed(2)}.`,
    );
  }

  if (
    context.side === "BUY" &&
    context.bucket === "SPECULATIVE" &&
    context.experimentalCapital > 0 &&
    context.currentExperimentalBudgetTotal > context.experimentalCapital
  ) {
    reasons.push(
      `Budget capitale sperimentale (€${context.currentExperimentalBudgetTotal.toFixed(2)}) supera il limite (€${context.experimentalCapital.toFixed(2)}).`,
    );
  }

  if (context.side === "BUY" && context.bucket !== "SPECULATIVE") {
    const cashAfter = context.cashBalance - context.orderAmount;
    if (cashAfter < context.minCashReserve) {
      reasons.push(
        `Dopo l'acquisto la liquidità (€${cashAfter.toFixed(2)}) scenderebbe sotto la riserva minima (€${context.minCashReserve.toFixed(2)}).`,
      );
    }
  }

  return {
    reasons,
    warnings: [],
    block: reasons.some(
      (r) =>
        r.includes("insufficiente") ||
        r.includes("riserva minima") ||
        r.includes("sperimentale"),
    ),
  };
}
