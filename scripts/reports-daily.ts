import { buildDailyReport } from "@/lib/reports/daily";

async function main() {
  const report = await buildDailyReport();
  console.log(
    "Report giornaliero generato:",
    JSON.stringify(
      {
        date: report.date,
        totalValue: report.portfolio.totalValue,
        dailyPnl: report.portfolio.dailyPnlAmount,
        riskLevel: report.risk.level,
        ordersExecuted: report.operations.ordersExecuted,
        ordersBlocked: report.operations.ordersBlocked,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    const { prisma } = await import("@/lib/db");
    await prisma.$disconnect();
  });
