import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { prisma } from "@/lib/db";
import { scoreJournal } from "@/lib/journal";

export async function resetExecutionTables() {
  await prisma.auditLog.deleteMany();
  await prisma.executionLog.deleteMany();
  await prisma.riskDecision.deleteMany();
  await prisma.orderIntent.deleteMany();
}

export async function seedExecutionFixtures() {
  await resetExecutionTables();
  await prisma.tradeJournal.deleteMany();
  await prisma.priceSnapshot.deleteMany();
  await prisma.position.deleteMany();
  await prisma.asset.deleteMany();
  await prisma.userSettings.deleteMany();

  await prisma.userSettings.create({
    data: {
      id: "default",
      hypotheticalCapital: 100000,
      cashBalance: 50000,
      experimentalCashBalance: 5000,
      executionMode: "MOCK",
      killSwitchActive: false,
      maxPositionPct: 50,
      maxBucketPct: 80,
      maxDailyOrders: 50,
      maxOrderAmount: 10000,
      maxLiveOrderAmount: 5000,
      maxDailyLiveAmount: 20000,
      maxMonthlyLiveAmount: 100000,
      minCashReserve: 100,
      maxCryptoPct: 50,
      maxDailyLossPct: 50,
      maxMonthlyLossPct: 50,
      maxExperimentalPct: 50,
      maxDrawdownPct: 50,
      peakPortfolioValue: 100000,
      dailyBaselineValue: 100000,
      monthlyBaselineValue: 100000,
      dailyBaselineDate: new Date(),
      monthlyBaselineKey: new Date().toISOString().slice(0, 7),
      tradingWindowEnabled: false,
      tradingStartHour: 9,
      tradingEndHour: 18,
      tradingTimezone: "Europe/Rome",
      maxSingleCryptoPct: 50,
      leverageAllowed: false,
      maxAssetPumpPct: 100,
      assetPumpLookbackDays: 7,
      maxAssetVolatilityPct: 200,
      revengeTradingLossPct: 10,
      experimentalCapital: 5000,
    },
  });

  const asset = await prisma.asset.create({
    data: {
      symbol: "TEST",
      name: "Test Asset",
      assetType: "ETF",
      bucket: "CORE",
      provider: "manual",
      providerSymbol: "TEST",
    },
  });

  await prisma.priceSnapshot.create({
    data: {
      assetId: asset.id,
      price: 100,
      currency: "EUR",
      source: "manual",
      capturedAt: new Date(),
    },
  });

  const journalInput = {
    title: "Test journal execution",
    thesis:
      "Decisione di test per validare il flusso di esecuzione ordini con risk gate e journal completo.",
    risks:
      "Rischio mercato, volatilità e possibile drawdown temporaneo del portafoglio nel breve periodo.",
    invalidation:
      "Invalidazione se drawdown superiore al 15% o deterioramento fondamentali macroeconomici.",
    emotionalState: "Calmo",
    timeHorizon: "6-12 mesi",
    maxAcceptableLoss: 500,
    exitRule:
      "Uscita parziale se perdita superiore al 5%. Uscita totale se invalidazione macro si verifica.",
    emotionScore: 3,
    confidenceScore: 7,
    planned: true,
  };

  const scored = scoreJournal(journalInput);

  const journal = await prisma.tradeJournal.create({
    data: {
      ...journalInput,
      isComplete: scored.isComplete,
      qualityScore: scored.qualityScore,
    },
  });

  return { asset, journal, prisma };
}

export async function disconnectExecutionFixtures() {
  await prisma.$disconnect();
}

export function runTestMigrations() {
  const dbUrl =
    process.env.DATABASE_URL ??
    `file:${path.resolve(__dirname, "../../prisma/test-execution.db")}`;
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
