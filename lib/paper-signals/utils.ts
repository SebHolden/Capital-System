import type { PaperSignalType } from "@prisma/client";
import type { PriceBar } from "@/lib/prices/history";
import type { StrategySignal } from "@/lib/strategies";

export function mapSignalType(side: StrategySignal["side"]): PaperSignalType {
  switch (side) {
    case "BUY":
      return "BUY";
    case "SELL":
      return "SELL";
    case "HOLD":
      return "REBALANCE";
    default:
      return "HOLD";
  }
}

export function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

export function resultPctForSide(
  side: PaperSignalType,
  entry: number,
  price: number,
): number | null {
  if (entry <= 0 || price <= 0) return null;

  if (side === "SELL") {
    return ((entry - price) / entry) * 100;
  }

  return ((price - entry) / entry) * 100;
}

export function findBarOnOrAfter(bars: PriceBar[], target: Date): PriceBar | null {
  const key = toDateKey(target);
  return bars.find((bar) => bar.date >= key) ?? bars[bars.length - 1] ?? null;
}

export function findBarOnOrBefore(bars: PriceBar[], target: Date): PriceBar | null {
  const key = toDateKey(target);
  let found: PriceBar | null = null;
  for (const bar of bars) {
    if (bar.date <= key) found = bar;
    else break;
  }
  return found;
}

export function computeMaeMfe(
  side: PaperSignalType,
  entry: number,
  bars: PriceBar[],
): { maePct: number | null; mfePct: number | null } {
  if (entry <= 0 || bars.length === 0) {
    return { maePct: null, mfePct: null };
  }

  let mae = 0;
  let mfe = 0;

  for (const bar of bars) {
    const result = resultPctForSide(side, entry, bar.close);
    if (result === null) continue;
    if (result < mae) mae = result;
    if (result > mfe) mfe = result;
  }

  return { maePct: mae, mfePct: mfe };
}
