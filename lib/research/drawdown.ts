import type { PriceBar } from "@/lib/prices/history";

export function maxDrawdownPct(bars: PriceBar[]): number {
  if (bars.length === 0) return 0;

  let peak = bars[0].close;
  let maxDd = 0;

  for (const bar of bars) {
    if (bar.close > peak) peak = bar.close;
    if (peak > 0) {
      const dd = ((peak - bar.close) / peak) * 100;
      if (dd > maxDd) maxDd = dd;
    }
  }

  return maxDd;
}

export function currentDrawdownPct(bars: PriceBar[]): number {
  if (bars.length === 0) return 0;

  let peak = bars[0].close;
  for (const bar of bars) {
    if (bar.close > peak) peak = bar.close;
  }

  const last = bars[bars.length - 1].close;
  if (peak <= 0) return 0;
  return ((peak - last) / peak) * 100;
}
