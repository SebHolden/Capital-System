import { NextResponse } from "next/server";
import { listBacktestRuns, runBacktest } from "@/lib/backtesting";
import { runBacktestSchema } from "@/lib/backtesting/schemas";
import { mapMutatingSecurityError, verifyMutatingRequest } from "@/lib/security";
import { logError } from "@/lib/logger";

export async function GET() {
  try {
    const runs = await listBacktestRuns(20);
    return NextResponse.json({ runs });
  } catch (error) {
    logError("Request failed", error);
    return NextResponse.json(
      { error: "Errore nel recupero dei backtest.", code: "BACKTEST_LIST_ERROR" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    verifyMutatingRequest(request);
    const body = await request.json();
    const parsed = runBacktestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten(), code: "VALIDATION_ERROR" },
        { status: 400 },
      );
    }

    const startDate = new Date(parsed.data.startDate);
    const endDate = new Date(parsed.data.endDate);

    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      return NextResponse.json(
        { error: "Date non valide.", code: "INVALID_DATES" },
        { status: 400 },
      );
    }

    const output = await runBacktest({
      strategyType: parsed.data.strategyType,
      assetId: parsed.data.assetId,
      startDate,
      endDate,
      initialCapital: parsed.data.initialCapital,
      commissionBps: parsed.data.commissionBps,
      slippageBps: parsed.data.slippageBps,
      config: parsed.data.config,
      rebalanceAssetIds: parsed.data.rebalanceAssetIds,
      walkForward: parsed.data.walkForward,
    });

    return NextResponse.json({
      runId: output.runId,
      dataSource: output.dataSource,
      warning: output.warning,
      metrics: output.result.metrics,
      benchmark: output.result.benchmarkMetrics,
      equityCurve: output.result.equityCurve,
      tradeCount: output.result.trades.length,
    });
  } catch (error) {
    const securityError = mapMutatingSecurityError(error);
    if (securityError) return securityError;
    logError("Request failed", error);
    const message =
      error instanceof Error ? error.message : "Errore nell'esecuzione del backtest.";
    return NextResponse.json(
      { error: message, code: "BACKTEST_RUN_ERROR" },
      { status: 500 },
    );
  }
}
