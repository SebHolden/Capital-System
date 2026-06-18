import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";

let paperTestPrisma: PrismaClient | null = null;

export function getPaperTestPrisma(): PrismaClient {
  if (!paperTestPrisma) {
    paperTestPrisma = new PrismaClient();
  }
  return paperTestPrisma;
}

export async function disconnectPaperFixtures() {
  if (paperTestPrisma) {
    await paperTestPrisma.$disconnect();
    paperTestPrisma = null;
  }
}

export function setupPaperTestDatabase(dbFileName: string): void {
  const dbPath = path.resolve(__dirname, "../../prisma", dbFileName);
  const dbUrl = `file:${dbPath}`;
  process.env.DATABASE_URL = dbUrl;

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

  paperTestPrisma = new PrismaClient({
    datasources: { db: { url: dbUrl } },
  });
}

export async function resetPaperTables() {
  const prisma = getPaperTestPrisma();
  await prisma.paperSignal.deleteMany();
  await prisma.backtestRun.deleteMany();
  await prisma.strategy.deleteMany();
  await prisma.asset.deleteMany();
}

export async function seedPaperFixtures() {
  const prisma = getPaperTestPrisma();
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

/** @deprecated use setupPaperTestDatabase */
export function runPaperTestMigrations() {
  setupPaperTestDatabase("test-paper.db");
}

export { getPaperTestPrisma as testPrisma };
