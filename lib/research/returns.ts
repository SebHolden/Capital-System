import type { PriceBar } from "@/lib/prices/history";

export function dailyReturns(bars: PriceBar[]): number[] {
  const returns: number[] = [];
  for (let i = 1; i < bars.length; i++) {
    const prev = bars[i - 1].close;
    const curr = bars[i].close;
    if (prev > 0) {
      returns.push((curr - prev) / prev);
    }
  }
  return returns;
}

export function cumulativeReturn(bars: PriceBar[]): number | null {
  if (bars.length < 2) return null;
  const first = bars[0].close;
  const last = bars[bars.length - 1].close;
  if (first <= 0) return null;
  return ((last - first) / first) * 100;
}
