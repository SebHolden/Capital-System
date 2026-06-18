import { prisma } from "@/lib/db";
import { fetchPriceHistory } from "@/lib/prices/history";
import { cumulativeReturn, dailyReturns } from "./returns";
import { annualizedVolatility } from "./volatility";
import { currentDrawdownPct, maxDrawdownPct } from "./drawdown";
import { correlationMatrix } from "./correlation";
import { benchmarkComparison, defaultBenchmarkSymbol } from "./benchmarks";

export interface AssetResearchRow {
  symbol: string;
  name: string;
  dataSource: string;
  returnPct: number | null;
  volatilityPct: number | null;
  maxDrawdownPct: number;
  currentDrawdownPct: number;
  warning?: string;
}

export interface ResearchSummary {
  periodDays: number;
  assets: AssetResearchRow[];
  correlation: Record<string, Record<string, number | null>>;
  benchmark: {
    symbol: string;
    returnPct: number | null;
    portfolioAvgReturnPct: number | null;
    comparison: ReturnType<typeof benchmarkComparison>;
  };
}

export async function buildResearchSummary(
  symbols?: string[],
  periodDays = 90,
): Promise<ResearchSummary> {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - periodDays);

  const assets = symbols?.length
    ? await prisma.asset.findMany({
        where: { symbol: { in: symbols.map((s) => s.toUpperCase()) } },
      })
    : await prisma.asset.findMany({ take: 5, orderBy: { symbol: "asc" } });

  const rows: AssetResearchRow[] = [];
  const returnSeries: Record<string, number[]> = {};

  for (const asset of assets) {
    const history = await fetchPriceHistory(asset, from, to);
    const returns = dailyReturns(history.bars);
    returnSeries[asset.symbol] = returns;

    rows.push({
      symbol: asset.symbol,
      name: asset.name,
      dataSource: history.dataSource,
      returnPct: cumulativeReturn(history.bars),
      volatilityPct: annualizedVolatility(returns),
      maxDrawdownPct: maxDrawdownPct(history.bars),
      currentDrawdownPct: currentDrawdownPct(history.bars),
      warning: history.warning,
    });
  }

  const benchmarkSymbol = defaultBenchmarkSymbol();
  let benchmarkReturnPct: number | null = null;

  const benchmarkAsset = await prisma.asset.findUnique({
    where: { symbol: benchmarkSymbol },
  });
  if (benchmarkAsset) {
    const benchHistory = await fetchPriceHistory(benchmarkAsset, from, to);
    benchmarkReturnPct = cumulativeReturn(benchHistory.bars);
  }

  const portfolioReturns = rows
    .map((r) => r.returnPct)
    .filter((v): v is number => v !== null);
  const portfolioAvgReturnPct =
    portfolioReturns.length > 0
      ? portfolioReturns.reduce((a, b) => a + b, 0) / portfolioReturns.length
      : null;

  return {
    periodDays,
    assets: rows,
    correlation: correlationMatrix(returnSeries),
    benchmark: {
      symbol: benchmarkSymbol,
      returnPct: benchmarkReturnPct,
      portfolioAvgReturnPct,
      comparison: benchmarkComparison(
        portfolioAvgReturnPct,
        benchmarkReturnPct,
      ),
    },
  };
}
