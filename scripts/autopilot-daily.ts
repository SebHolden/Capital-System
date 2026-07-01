import { runDailyWorkflow } from "@/lib/autopilot";

async function main() {
  const { brief, workflow } = await runDailyWorkflow();
  console.log(
    "Autopilot daily workflow completato:",
    JSON.stringify({ workflow, briefDate: brief.date }, null, 2),
  );
  console.log(
    "Sicurezza:",
    brief.safetyNotice.messages.join(" | "),
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
