import { NextResponse } from "next/server";
import { buildStrategyEvaluationReport } from "@/lib/reports/strategyEvaluation";

export async function GET() {
  try {
    const report = await buildStrategyEvaluationReport();
    return NextResponse.json(report);
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      {
        error: "Errore nel report valutazione strategie.",
        code: "STRATEGY_EVALUATION_REPORT_ERROR",
      },
      { status: 500 },
    );
  }
}
