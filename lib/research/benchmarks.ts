export function benchmarkComparison(
  portfolioReturnPct: number | null,
  benchmarkReturnPct: number | null,
): {
  outperformancePct: number | null;
  note: string;
} {
  if (portfolioReturnPct === null || benchmarkReturnPct === null) {
    return {
      outperformancePct: null,
      note: "Dati benchmark o portfolio insufficienti.",
    };
  }

  return {
    outperformancePct: portfolioReturnPct - benchmarkReturnPct,
    note: "Confronto su periodo selezionato (rendimento semplice).",
  };
}

export function defaultBenchmarkSymbol(): string {
  return process.env.REPORTS_BENCHMARK_SYMBOL?.trim() || "BTC";
}
