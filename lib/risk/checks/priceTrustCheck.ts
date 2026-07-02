import type { PriceStatus } from "@/lib/prices/types";
import type { RiskCheckResult } from "./types";

export const UNTRUSTED_ASSET_PRICE_REASON =
  "Prezzo non affidabile: asset stale/manual/missing";

export const AUTOMATIC_TRADING_BLOCKED_REASON =
  "Dati prezzo non affidabili: trading automatico bloccato";

export const UNTRUSTED_EXPOSURE_REASON =
  "Esposizione con prezzi non trusted sopra soglia";

export function evaluateAssetPriceTrustCheck(input: {
  priceStatus: PriceStatus;
  side: "BUY" | "SELL";
  automatic?: boolean;
}): RiskCheckResult {
  if (input.priceStatus === "fresh") {
    return { reasons: [], warnings: [], block: false };
  }

  if (input.automatic) {
    return {
      reasons: [AUTOMATIC_TRADING_BLOCKED_REASON],
      warnings: [],
      block: true,
    };
  }

  if (input.side === "BUY") {
    return {
      reasons: [UNTRUSTED_ASSET_PRICE_REASON],
      warnings: [],
      block: true,
    };
  }

  return {
    reasons: [],
    warnings: [UNTRUSTED_ASSET_PRICE_REASON],
    block: false,
  };
}

export function evaluatePortfolioPriceTrustCheck(input: {
  hasUntrustedPrices: boolean;
  untrustedPct: number;
  executionMode?: "MOCK" | "PAPER" | "LIVE";
}): RiskCheckResult {
  if (!input.hasUntrustedPrices) {
    return { reasons: [], warnings: [], block: false };
  }

  if (input.executionMode === "LIVE" && input.untrustedPct > 0) {
    return {
      reasons: [UNTRUSTED_EXPOSURE_REASON],
      warnings: [],
      block: true,
    };
  }

  if (input.executionMode === "PAPER" && input.untrustedPct > 0) {
    return {
      reasons: [UNTRUSTED_EXPOSURE_REASON],
      warnings: [],
      block: true,
    };
  }

  return {
    reasons: [],
    warnings: [UNTRUSTED_EXPOSURE_REASON],
    block: false,
  };
}
