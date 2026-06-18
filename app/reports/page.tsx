import { buildDailyReport } from "@/lib/reports/daily";
import { buildMonthlyReport } from "@/lib/reports/monthly";
import { buildWeeklyReport } from "@/lib/reports/weekly";
import { buildStrategyEvaluationReport } from "@/lib/reports/strategyEvaluation";
import { ReportsClient } from "@/components/reports/ReportsClient";

export default async function ReportsPage() {
  const [daily, weekly, monthly, strategy] = await Promise.all([
    buildDailyReport(),
    buildWeeklyReport(),
    buildMonthlyReport(),
    buildStrategyEvaluationReport(),
  ]);

  return (
    <ReportsClient
      initialDaily={daily}
      initialWeekly={weekly}
      initialMonthly={monthly}
      initialStrategy={strategy}
    />
  );
}
