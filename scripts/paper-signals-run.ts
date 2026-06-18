import { runPaperSignalsPipeline } from "@/lib/paper-signals";

async function main() {
  const result = await runPaperSignalsPipeline();
  console.log("Paper signals pipeline completata:", JSON.stringify(result, null, 2));
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
