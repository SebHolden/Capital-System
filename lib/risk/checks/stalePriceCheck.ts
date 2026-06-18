import type { PriceStatus } from "@/lib/prices/types";
import type { RiskCheckResult } from "./types";

export function evaluateStalePriceCheck(input: {
  side: "BUY" | "SELL";
  priceStatus: PriceStatus;
  symbol: string;
}): RiskCheckResult {
  if (input.side !== "BUY") {
    return { reasons: [], warnings: [], block: false };
  }

  if (input.priceStatus === "stale") {
    return {
      reasons: [
        `Prezzo stale per ${input.symbol}: aggiorna i prezzi prima di acquistare.`,
      ],
      warnings: [],
      block: true,
    };
  }

  if (input.priceStatus === "missing") {
    return {
      reasons: [
        `Prezzo mancante per ${input.symbol}: impossibile valutare un acquisto sicuro.`,
      ],
      warnings: [],
      block: true,
    };
  }

  if (input.priceStatus === "manual") {
    return {
      reasons: [],
      warnings: [
        `Prezzo manuale/fallback per ${input.symbol} — verifica prima di acquistare.`,
      ],
      block: false,
    };
  }

  return { reasons: [], warnings: [], block: false };
}
