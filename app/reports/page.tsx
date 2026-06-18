import { buildDailyReport } from "@/lib/reports/daily";
import { buildMonthlyReport } from "@/lib/reports/monthly";
import { buildWeeklyReport } from "@/lib/reports/weekly";
import { ReportsClient } from "@/components/reports/ReportsClient";

export default async function ReportsPage() {
  const [daily, weekly, monthly] = await Promise.all([
    buildDailyReport(),
    buildWeeklyReport(),
    buildMonthlyReport(),
  ]);

  return (
    <ReportsClient
      initialDaily={daily}
      initialWeekly={weekly}
      initialMonthly={monthly}
    />
  );
}
