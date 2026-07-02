import type { PriceStatus } from "@/lib/prices/types";
import type { RiskCheckResult } from "./types";
import { evaluateAssetPriceTrustCheck } from "./priceTrustCheck";

/** @deprecated Use evaluateAssetPriceTrustCheck from priceTrustCheck */
export function evaluateStalePriceCheck(input: {
  side: "BUY" | "SELL";
  priceStatus: PriceStatus;
  symbol: string;
  automatic?: boolean;
}): RiskCheckResult {
  return evaluateAssetPriceTrustCheck({
    side: input.side,
    priceStatus: input.priceStatus,
    automatic: input.automatic,
  });
}
