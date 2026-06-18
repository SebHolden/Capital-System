export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  }).format(value);
}

export function formatPct(value: number): string {
  return `${value.toFixed(1)}%`;
}

const BUCKET_LABELS: Record<string, string> = {
  CASH: "Liquidità",
  CORE: "Core ETF",
  GROWTH: "Azioni / Growth",
  SPECULATIVE: "Crypto sperimentale",
  HEDGE: "Hedge / Oro",
};

export function bucketLabel(bucket: string): string {
  return BUCKET_LABELS[bucket] ?? bucket;
}
