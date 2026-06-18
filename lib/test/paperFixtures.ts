import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { prisma } from "@/lib/db";

export async function resetPaperTables() {
  await prisma.paperSignal.deleteMany();
  await prisma.backtestRun.deleteMany();
  await prisma.strategy.deleteMany();
  await prisma.asset.deleteMany();
}

export async function seedPaperFixtures() {
  await resetPaperTables();

  const asset = await prisma.asset.create({
    data: {
      symbol: "PAPER",
      name: "Paper Test Asset",
      assetType: "ETF",
      bucket: "CORE",
      provider: "manual",
      providerSymbol: "PAPER",
    },
  });

  const strategy = await prisma.strategy.create({
    data: {
      id: "test-paper-strategy",
      name: "Test Paper Strategy",
      description: "Integration test strategy",
      type: "DCA_MONTHLY",
      status: "PAPER_ACTIVE",
      primaryAssetId: asset.id,
      configJson: JSON.stringify({ monthlyAmountEur: 250 }),
      paperActiveAt: new Date(),
    },
  });

  return { asset, strategy, prisma };
}

export async function disconnectPaperFixtures() {
  await prisma.$disconnect();
}

export function runPaperTestMigrations() {
  const dbUrl =
    process.env.DATABASE_URL ??
    `file:${path.resolve(__dirname, "../../prisma/test-paper.db")}`;
  const dbPath = dbUrl.replace(/^file:/, "");

  for (const file of [dbPath, `${dbPath}-journal`]) {
    if (fs.existsSync(file)) {
      fs.unlinkSync(file);
    }
  }

  execSync("npx prisma db push --accept-data-loss", {
    env: {
      ...process.env,
      DATABASE_URL: dbUrl,
    },
    cwd: path.resolve(__dirname, "../.."),
    stdio: "pipe",
  });
}

export { prisma as testPrisma };
