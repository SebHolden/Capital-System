import type { OrderContext } from "../types";
import type { RiskCheckResult } from "./types";

export function evaluateOrderSizeCheck(context: OrderContext): RiskCheckResult {
  const reasons: string[] = [];
  const warnings: string[] = [];
  let block = false;

  if (context.side === "BUY" && context.orderAmount > context.maxOrderAmount) {
    reasons.push(
      `Importo ordine (€${context.orderAmount.toFixed(2)}) supera il limite (€${context.maxOrderAmount.toFixed(2)}).`,
    );
  }

  if (context.dailyOrderCount >= context.maxDailyOrders) {
    reasons.push(
      `Limite ordini giornalieri raggiunto (${context.maxDailyOrders}).`,
    );
    block = true;
  }

  return { reasons, warnings, block };
}
