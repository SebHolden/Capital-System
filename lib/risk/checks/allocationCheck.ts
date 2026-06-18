import type { OrderContext } from "../types";
import type { RiskCheckResult } from "./types";

export function evaluateAllocationCheck(context: OrderContext): RiskCheckResult {
  const reasons: string[] = [];

  if (
    context.assetType === "CRYPTO" &&
    context.projectedCryptoPct > context.maxCryptoPct
  ) {
    reasons.push(
      `Allocazione crypto (${context.projectedCryptoPct.toFixed(1)}%) supera il limite (${context.maxCryptoPct}%).`,
    );
  }

  if (
    context.bucket === "SPECULATIVE" &&
    context.projectedExperimentalPct > context.maxExperimentalPct
  ) {
    reasons.push(
      `Allocazione experimental (${context.projectedExperimentalPct.toFixed(1)}%) supera il limite (${context.maxExperimentalPct}%).`,
    );
  }

  const projectedPositionValue =
    context.side === "BUY"
      ? context.currentPositionValue + context.orderAmount
      : Math.max(0, context.currentPositionValue - context.orderAmount);

  const totalPortfolio =
    context.cashBalance +
    context.currentPositionValue +
    (context.side === "BUY" ? 0 : context.orderAmount);

  const projectedPositionPct =
    totalPortfolio > 0 ? (projectedPositionValue / totalPortfolio) * 100 : 0;

  if (projectedPositionPct > context.maxPositionPct) {
    reasons.push(
      `Esposizione posizione (${projectedPositionPct.toFixed(1)}%) supera il limite (${context.maxPositionPct}%).`,
    );
  }

  if (context.projectedBucketPct > context.maxBucketPct) {
    reasons.push(
      `Allocazione bucket (${context.projectedBucketPct.toFixed(1)}%) supera il limite (${context.maxBucketPct}%).`,
    );
  }

  if (
    context.assetType === "CRYPTO" &&
    context.projectedSingleCryptoPct > context.maxSingleCryptoPct
  ) {
    reasons.push(
      `Allocazione singola crypto (${context.projectedSingleCryptoPct.toFixed(1)}%) supera il limite (${context.maxSingleCryptoPct}%).`,
    );
  }

  return {
    reasons,
    warnings: [],
    block: reasons.length > 0,
  };
}
