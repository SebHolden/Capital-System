import { PremiumDashboard } from "@/components/dashboard/PremiumDashboard";
import { getBucketAllocation, getPortfolioSummary } from "@/lib/portfolio";

export default async function DashboardPage() {
  const [summary, allocation] = await Promise.all([
    getPortfolioSummary(),
    getBucketAllocation(),
  ]);

  const {
    portfolio,
    riskMetrics,
    stressTest,
    settings,
    exposure,
    riskScore,
  } = summary;

  return (
    <PremiumDashboard
      portfolio={portfolio}
      exposure={exposure}
      riskScore={riskScore}
      riskMetrics={riskMetrics}
      allocation={allocation}
      stressTest={stressTest}
      settings={settings}
    />
  );
}
