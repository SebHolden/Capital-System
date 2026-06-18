import { PrismaClient } from "@prisma/client";
import { rescoreAllJournals, scoreJournal } from "../lib/journal";

const prisma = new PrismaClient();

async function main() {
  await prisma.paperSignal.deleteMany();
  await prisma.backtestTrade.deleteMany();
  await prisma.backtestRun.deleteMany();
  await prisma.monthlyReport.deleteMany();
  await prisma.portfolioSnapshot.deleteMany();
  await prisma.strategy.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.executionLog.deleteMany();
  await prisma.riskDecision.deleteMany();
  await prisma.orderIntent.deleteMany();
  await prisma.tradeJournal.deleteMany();
  await prisma.priceSnapshot.deleteMany();
  await prisma.position.deleteMany();
  await prisma.asset.deleteMany();
  await prisma.userSettings.deleteMany();

  const settings = await prisma.userSettings.create({
    data: {
      id: "default",
      hypotheticalCapital: 10000,
      cashBalance: 5200,
      experimentalCapital: 1000,
      experimentalCashBalance: 300,
      executionMode: "MOCK",
      killSwitchActive: false,
      maxPositionPct: 25,
      maxBucketPct: 40,
      maxDailyOrders: 3,
      maxOrderAmount: 1000,
      maxLiveOrderAmount: 500,
      maxDailyLiveAmount: 2000,
      maxMonthlyLiveAmount: 10000,
      minCashReserve: 1000,
      maxCryptoPct: 15,
      maxDailyLossPct: 2,
      maxMonthlyLossPct: 5,
      maxExperimentalPct: 5,
      maxDrawdownPct: 15,
      peakPortfolioValue: 10000,
      dailyBaselineValue: 10000,
      dailyBaselineDate: new Date(),
      monthlyBaselineValue: 10000,
      monthlyBaselineKey: new Date().toISOString().slice(0, 7),
      tradingWindowEnabled: true,
      tradingStartHour: 9,
      tradingEndHour: 18,
      tradingTimezone: "Europe/Rome",
      maxSingleCryptoPct: 5,
      leverageAllowed: false,
      maxAssetPumpPct: 15,
      assetPumpLookbackDays: 7,
      maxAssetVolatilityPct: 80,
      revengeTradingLossPct: 1,
    },
  });

  const assets = await Promise.all([
    prisma.asset.create({
      data: {
        symbol: "SWDA",
        name: "iShares Core MSCI World",
        assetType: "ETF",
        bucket: "CORE",
        provider: "finnhub",
        providerSymbol: "SWDA",
      },
    }),
    prisma.asset.create({
      data: {
        symbol: "EIMI",
        name: "iShares Core MSCI EM IMI",
        assetType: "ETF",
        bucket: "GROWTH",
        provider: "finnhub",
        providerSymbol: "EIMI",
      },
    }),
    prisma.asset.create({
      data: {
        symbol: "SGLD",
        name: "iShares Physical Gold",
        assetType: "ETF",
        bucket: "HEDGE",
        provider: "finnhub",
        providerSymbol: "SGLD",
      },
    }),
    prisma.asset.create({
      data: {
        symbol: "BTC",
        name: "Bitcoin (tracking)",
        assetType: "CRYPTO",
        bucket: "SPECULATIVE",
        provider: "coingecko",
        providerSymbol: "bitcoin",
      },
    }),
  ]);

  const [swda, eimi, sgld, btc] = assets;

  await prisma.position.createMany({
    data: [
      {
        assetId: swda.id,
        quantity: 10,
        avgPrice: 85,
        bucket: "CORE",
        notes: "Core allocation mondiale",
      },
      {
        assetId: eimi.id,
        quantity: 15,
        avgPrice: 30,
        bucket: "GROWTH",
        notes: "Esposizione mercati emergenti",
      },
      {
        assetId: sgld.id,
        quantity: 5,
        avgPrice: 40,
        bucket: "HEDGE",
        notes: "Copertura inflazionistica",
      },
      {
        assetId: btc.id,
        quantity: 0.05,
        avgPrice: 60000,
        bucket: "SPECULATIVE",
        notes: "Posizione speculativa ridotta",
      },
    ],
  });

  const seedJournal = {
    title: "Ribilanciamento Q2 — aumento CORE",
    thesis:
      "Mercati sviluppati sottovalutati rispetto al fair value. Aumento graduale esposizione CORE per ridurre volatilità complessiva del portafoglio nel medio termine.",
    risks:
      "Rischio recessione USA, tightening monetario, correlazione elevata tra asset. Possibile prolungamento fase laterale dei mercati.",
    invalidation:
      "Uscita se drawdown portafoglio > 15% o se tassi reali superano il 3% per 2 trimestri consecutivi.",
    emotionalState: "Calmo, nessuna urgenza. Decisione pianificata.",
    timeHorizon: "6-12 mesi",
    maxAcceptableLoss: 500,
    exitRule:
      "Ridurre esposizione del 50% se SWDA perde il 10% dal prezzo di ingresso. Uscita totale se invalidazione macro si verifica.",
    emotionScore: 3,
    confidenceScore: 7,
    planned: true,
  };

  const scored = scoreJournal(seedJournal);

  await prisma.tradeJournal.create({
    data: {
      ...seedJournal,
      isComplete: scored.isComplete,
      qualityScore: scored.qualityScore,
    },
  });

  await rescoreAllJournals(prisma);

  const endDate = new Date();
  const startDate = new Date();
  startDate.setFullYear(endDate.getFullYear() - 1);

  try {
    const { runBacktest } = await import("../lib/backtesting");
    await runBacktest({
      strategyType: "DCA_MONTHLY",
      assetId: btc.id,
      startDate,
      endDate,
      initialCapital: 10000,
      config: { monthlyAmountEur: 250 },
    });
    console.log("Backtest demo DCA su BTC creato.");

    const dcaStrategy = await prisma.strategy.findUnique({
      where: { id: "preset-dca_monthly" },
    });
    if (dcaStrategy) {
      await prisma.strategy.update({
        where: { id: dcaStrategy.id },
        data: {
          status: "BACKTESTED",
          primaryAssetId: btc.id,
        },
      });

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 35);

      const closedSignalDate = new Date();
      closedSignalDate.setDate(closedSignalDate.getDate() - 45);

      await prisma.paperSignal.create({
        data: {
          strategyId: dcaStrategy.id,
          assetId: btc.id,
          signalDate: thirtyDaysAgo,
          signalType: "BUY",
          plannedEntry: 58000,
          amountEur: 250,
          reason: "DCA_MONTHLY",
          currentResultPct: 2.5,
          result1dPct: 0.8,
          result7dPct: 1.2,
          result30dPct: 3.8,
          maePct: -4.2,
          mfePct: 6.1,
          ruleFollowed: true,
          status: "OPEN",
          lastMonitoredAt: new Date(),
        },
      });

      await prisma.paperSignal.create({
        data: {
          strategyId: dcaStrategy.id,
          assetId: btc.id,
          signalDate: closedSignalDate,
          signalType: "BUY",
          plannedEntry: 55000,
          amountEur: 250,
          reason: "DCA_MONTHLY",
          currentResultPct: 4.1,
          result1dPct: 1.5,
          result7dPct: 2.8,
          result30dPct: 5.2,
          maePct: -3.1,
          mfePct: 7.4,
          ruleFollowed: true,
          status: "CLOSED",
          closedAt: new Date(),
          closeReason: "HORIZON_30D",
          lastMonitoredAt: new Date(),
        },
      });
      console.log("Paper signal demo creati.");
    }
  } catch (error) {
    console.warn(
      "Backtest demo non creato (rete o API non disponibile):",
      error instanceof Error ? error.message : error,
    );
  }

  await prisma.strategy.upsert({
    where: { id: "demo-promoted-live" },
    create: {
      id: "demo-promoted-live",
      name: "DCA Monthly (demo PROMOTED)",
      type: "DCA_MONTHLY",
      status: "PROMOTED",
      primaryAssetId: btc.id,
      configJson: JSON.stringify({ monthlyAmountEur: 250 }),
      promotedAt: new Date(),
    },
    update: {
      status: "PROMOTED",
      primaryAssetId: btc.id,
      promotedAt: new Date(),
    },
  });
  console.log("Strategia PROMOTED demo per gate LIVE.");

  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const formatDate = (d: Date) =>
    [
      d.getFullYear(),
      String(d.getMonth() + 1).padStart(2, "0"),
      String(d.getDate()).padStart(2, "0"),
    ].join("-");
  const monthKey = formatDate(today).slice(0, 7);

  await prisma.portfolioSnapshot.createMany({
    data: [
      {
        snapshotDate: formatDate(yesterday),
        totalValue: 9950,
        cashBalance: 5500,
        investedValue: 4450,
        dailyPnlPct: -0.5,
        monthlyPnlPct: 0.2,
        riskLevel: "GREEN",
        payloadJson: JSON.stringify({
          bucketPcts: { CORE: 45, GROWTH: 30, HEDGE: 15, SPECULATIVE: 10 },
          cryptoPct: 10,
          killSwitchActive: false,
          executionMode: "MOCK",
        }),
      },
      {
        snapshotDate: formatDate(today),
        totalValue: 10000,
        cashBalance: 5500,
        investedValue: 4500,
        dailyPnlPct: 0.5,
        monthlyPnlPct: 0.5,
        riskLevel: "GREEN",
        payloadJson: JSON.stringify({
          bucketPcts: { CORE: 45, GROWTH: 30, HEDGE: 15, SPECULATIVE: 10 },
          cryptoPct: 10,
          killSwitchActive: false,
          executionMode: "MOCK",
        }),
      },
    ],
  });

  await prisma.monthlyReport.create({
    data: {
      monthKey,
      decisionQualityScore: 72,
      payloadJson: JSON.stringify({
        type: "monthly",
        monthKey,
        note: "Report demo seed",
      }),
    },
  });
  console.log("Snapshot e MonthlyReport demo creati.");

  await prisma.auditLog.create({
    data: {
      action: "SEED_INITIALIZED",
      entity: "System",
      payload: JSON.stringify({
        hypotheticalCapital: settings.hypotheticalCapital,
        cashBalance: settings.cashBalance,
        investedValue: 4500,
        totalValue: 10000,
        positions: 4,
        assets: 4,
      }),
    },
  });

  console.log("Seed completato: scenario €10.000 inizializzato.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
