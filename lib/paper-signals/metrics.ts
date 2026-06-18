import type { PaperSignalType } from "@prisma/client";
import type { PriceBar } from "@/lib/prices/history";
import {
  addDays,
  computeMaeMfe,
  findBarOnOrAfter,
  resultPctForSide,
  toDateKey,
} from "./utils";

export interface SignalMetrics {
  currentResultPct: number | null;
  result1dPct: number | null;
  result7dPct: number | null;
  result30dPct: number | null;
  maePct: number | null;
  mfePct: number | null;
}

export function computeSignalMetrics(input: {
  signalType: PaperSignalType;
  plannedEntry: number;
  signalDate: Date;
  bars: PriceBar[];
  currentPrice: number;
}): SignalMetrics {
  const { signalType, plannedEntry, signalDate, bars, currentPrice } = input;

  const currentResultPct = resultPctForSide(
    signalType,
    plannedEntry,
    currentPrice,
  );

  const bar1d = findBarOnOrAfter(bars, addDays(signalDate, 1));
  const bar7d = findBarOnOrAfter(bars, addDays(signalDate, 7));
  const bar30d = findBarOnOrAfter(bars, addDays(signalDate, 30));

  const result1dPct = bar1d
    ? resultPctForSide(signalType, plannedEntry, bar1d.close)
    : null;
  const result7dPct = bar7d
    ? resultPctForSide(signalType, plannedEntry, bar7d.close)
    : null;
  const result30dPct = bar30d
    ? resultPctForSide(signalType, plannedEntry, bar30d.close)
    : null;

  const monitorBars = bars.filter(
    (bar) => bar.date >= toDateKey(signalDate),
  );
  const { maePct, mfePct } = computeMaeMfe(
    signalType,
    plannedEntry,
    monitorBars,
  );

  return {
    currentResultPct,
    result1dPct,
    result7dPct,
    result30dPct,
    maePct,
    mfePct,
  };
}
