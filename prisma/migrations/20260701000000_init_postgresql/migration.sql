-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "ExecutionMode" AS ENUM ('MOCK', 'PAPER', 'LIVE');

-- CreateEnum
CREATE TYPE "Bucket" AS ENUM ('CASH', 'CORE', 'GROWTH', 'SPECULATIVE', 'HEDGE');

-- CreateEnum
CREATE TYPE "AssetType" AS ENUM ('ETF', 'STOCK', 'BOND', 'CRYPTO', 'CASH', 'OTHER');

-- CreateEnum
CREATE TYPE "OrderSide" AS ENUM ('BUY', 'SELL');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'SIMULATED', 'EXECUTED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RiskLevel" AS ENUM ('GREEN', 'YELLOW', 'ORANGE', 'RED', 'BLACK');

-- CreateEnum
CREATE TYPE "ExecutionStatus" AS ENUM ('FILLED', 'REJECTED', 'PARTIAL');

-- CreateEnum
CREATE TYPE "StrategyType" AS ENUM ('DCA_MONTHLY', 'REBALANCE_MONTHLY', 'MOVING_AVERAGE_CROSS', 'MOMENTUM', 'BUY_THE_DIP', 'VOLATILITY_FILTER', 'CORE_SATELLITE');

-- CreateEnum
CREATE TYPE "BacktestStatus" AS ENUM ('COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "StrategyStatus" AS ENUM ('DRAFT', 'BACKTESTED', 'PAPER_ACTIVE', 'PROMOTED', 'REJECTED');

-- CreateEnum
CREATE TYPE "PaperSignalStatus" AS ENUM ('OPEN', 'CLOSED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "PaperSignalOutcome" AS ENUM ('WIN', 'LOSS', 'FLAT', 'EXPIRED', 'INSUFFICIENT_DATA', 'PENDING');

-- CreateEnum
CREATE TYPE "StrategyRating" AS ENUM ('POOR', 'WEAK', 'WATCH', 'GOOD', 'PROMOTABLE');

-- CreateEnum
CREATE TYPE "PaperSignalType" AS ENUM ('BUY', 'SELL', 'REBALANCE', 'HOLD');

-- CreateTable
CREATE TABLE "UserSettings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "hypotheticalCapital" DOUBLE PRECISION NOT NULL DEFAULT 10000,
    "cashBalance" DOUBLE PRECISION NOT NULL DEFAULT 10000,
    "executionMode" "ExecutionMode" NOT NULL DEFAULT 'MOCK',
    "killSwitchActive" BOOLEAN NOT NULL DEFAULT false,
    "maxPositionPct" DOUBLE PRECISION NOT NULL DEFAULT 25,
    "maxBucketPct" DOUBLE PRECISION NOT NULL DEFAULT 40,
    "maxDailyOrders" INTEGER NOT NULL DEFAULT 3,
    "maxOrderAmount" DOUBLE PRECISION NOT NULL DEFAULT 1000,
    "minCashReserve" DOUBLE PRECISION NOT NULL DEFAULT 1000,
    "maxCryptoPct" DOUBLE PRECISION NOT NULL DEFAULT 15,
    "maxDailyLossPct" DOUBLE PRECISION NOT NULL DEFAULT 2,
    "maxMonthlyLossPct" DOUBLE PRECISION NOT NULL DEFAULT 5,
    "maxExperimentalPct" DOUBLE PRECISION NOT NULL DEFAULT 5,
    "maxDrawdownPct" DOUBLE PRECISION NOT NULL DEFAULT 15,
    "peakPortfolioValue" DOUBLE PRECISION NOT NULL DEFAULT 10000,
    "dailyBaselineValue" DOUBLE PRECISION NOT NULL DEFAULT 10000,
    "dailyBaselineDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "monthlyBaselineValue" DOUBLE PRECISION NOT NULL DEFAULT 10000,
    "monthlyBaselineKey" TEXT NOT NULL DEFAULT '2026-01',
    "tradingWindowEnabled" BOOLEAN NOT NULL DEFAULT true,
    "tradingStartHour" INTEGER NOT NULL DEFAULT 9,
    "tradingEndHour" INTEGER NOT NULL DEFAULT 18,
    "tradingTimezone" TEXT NOT NULL DEFAULT 'Europe/Rome',
    "maxLiveOrderAmount" DOUBLE PRECISION NOT NULL DEFAULT 500,
    "maxDailyLiveAmount" DOUBLE PRECISION NOT NULL DEFAULT 2000,
    "maxMonthlyLiveAmount" DOUBLE PRECISION NOT NULL DEFAULT 10000,
    "maxSingleCryptoPct" DOUBLE PRECISION NOT NULL DEFAULT 5,
    "leverageAllowed" BOOLEAN NOT NULL DEFAULT false,
    "maxAssetPumpPct" DOUBLE PRECISION NOT NULL DEFAULT 15,
    "assetPumpLookbackDays" INTEGER NOT NULL DEFAULT 7,
    "maxAssetVolatilityPct" DOUBLE PRECISION NOT NULL DEFAULT 80,
    "revengeTradingLossPct" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "experimentalCapital" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "experimentalCashBalance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "rejectedOrderCooldownMinutes" INTEGER NOT NULL DEFAULT 15,
    "rejectAveragingDown" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Asset" (
    "id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "assetType" "AssetType" NOT NULL DEFAULT 'ETF',
    "bucket" "Bucket" NOT NULL DEFAULT 'CORE',
    "provider" TEXT,
    "providerSymbol" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HistoricalPrice" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "priceDate" TEXT NOT NULL,
    "close" DOUBLE PRECISION NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'import',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HistoricalPrice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Position" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "avgPrice" DOUBLE PRECISION NOT NULL,
    "bucket" "Bucket" NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Position_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceSnapshot" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "status" TEXT NOT NULL DEFAULT 'fresh',
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PriceSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TradeJournal" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "thesis" TEXT NOT NULL,
    "risks" TEXT NOT NULL,
    "invalidation" TEXT NOT NULL,
    "emotionalState" TEXT NOT NULL,
    "timeHorizon" TEXT NOT NULL DEFAULT '',
    "maxAcceptableLoss" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "exitRule" TEXT NOT NULL DEFAULT '',
    "emotionScore" INTEGER NOT NULL DEFAULT 5,
    "confidenceScore" INTEGER NOT NULL DEFAULT 5,
    "planned" BOOLEAN NOT NULL DEFAULT false,
    "qualityScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isComplete" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TradeJournal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderIntent" (
    "id" TEXT NOT NULL,
    "journalId" TEXT,
    "assetId" TEXT NOT NULL,
    "side" "OrderSide" NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "limitPrice" DOUBLE PRECISION,
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING',
    "idempotencyKey" TEXT,
    "executionMode" "ExecutionMode",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderIntent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RiskDecision" (
    "id" TEXT NOT NULL,
    "orderIntentId" TEXT NOT NULL,
    "level" "RiskLevel" NOT NULL,
    "reasons" TEXT NOT NULL,
    "blocked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RiskDecision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExecutionLog" (
    "id" TEXT NOT NULL,
    "orderIntentId" TEXT NOT NULL,
    "mode" "ExecutionMode" NOT NULL,
    "status" "ExecutionStatus" NOT NULL,
    "fillPrice" DOUBLE PRECISION,
    "message" TEXT NOT NULL,
    "brokerOrderId" TEXT,
    "idempotencyKey" TEXT,
    "costBasisPerUnit" DOUBLE PRECISION,
    "realizedPnl" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExecutionLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "payload" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrokerAccountSnapshot" (
    "id" TEXT NOT NULL,
    "brokerName" TEXT NOT NULL,
    "mode" "ExecutionMode" NOT NULL,
    "accountId" TEXT NOT NULL,
    "equity" DOUBLE PRECISION NOT NULL,
    "cash" DOUBLE PRECISION NOT NULL,
    "buyingPower" DOUBLE PRECISION,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "payloadJson" TEXT NOT NULL DEFAULT '{}',
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BrokerAccountSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PortfolioSnapshot" (
    "id" TEXT NOT NULL,
    "snapshotDate" TEXT NOT NULL,
    "totalValue" DOUBLE PRECISION NOT NULL,
    "cashBalance" DOUBLE PRECISION NOT NULL,
    "investedValue" DOUBLE PRECISION NOT NULL,
    "dailyPnlPct" DOUBLE PRECISION NOT NULL,
    "monthlyPnlPct" DOUBLE PRECISION NOT NULL,
    "riskLevel" TEXT NOT NULL,
    "payloadJson" TEXT NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PortfolioSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MonthlyReport" (
    "id" TEXT NOT NULL,
    "monthKey" TEXT NOT NULL,
    "decisionQualityScore" DOUBLE PRECISION NOT NULL,
    "payloadJson" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MonthlyReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Strategy" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "type" "StrategyType" NOT NULL,
    "configJson" TEXT NOT NULL DEFAULT '{}',
    "benchmarkSymbol" TEXT,
    "status" "StrategyStatus" NOT NULL DEFAULT 'DRAFT',
    "primaryAssetId" TEXT,
    "paperActiveAt" TIMESTAMP(3),
    "promotedAt" TIMESTAMP(3),
    "evaluationScore" INTEGER,
    "rating" "StrategyRating",
    "lastEvaluatedAt" TIMESTAMP(3),
    "walkForwardValidatedAt" TIMESTAMP(3),
    "walkForwardScore" DOUBLE PRECISION,
    "overfitScore" DOUBLE PRECISION,
    "dataQualityAvgScore" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Strategy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BacktestRun" (
    "id" TEXT NOT NULL,
    "strategyId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "initialCapital" DOUBLE PRECISION NOT NULL,
    "commissionBps" DOUBLE PRECISION NOT NULL DEFAULT 10,
    "slippageBps" DOUBLE PRECISION NOT NULL DEFAULT 10,
    "dataSource" TEXT NOT NULL DEFAULT 'live',
    "metricsJson" TEXT NOT NULL DEFAULT '{}',
    "benchmarkJson" TEXT,
    "equityCurveJson" TEXT NOT NULL DEFAULT '[]',
    "status" "BacktestStatus" NOT NULL DEFAULT 'COMPLETED',
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BacktestRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BacktestTrade" (
    "id" TEXT NOT NULL,
    "backtestRunId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "side" "OrderSide" NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "fees" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "reason" TEXT NOT NULL,

    CONSTRAINT "BacktestTrade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaperSignal" (
    "id" TEXT NOT NULL,
    "strategyId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "signalDate" TIMESTAMP(3) NOT NULL,
    "signalType" "PaperSignalType" NOT NULL,
    "plannedEntry" DOUBLE PRECISION NOT NULL,
    "amountEur" DOUBLE PRECISION,
    "quantity" DOUBLE PRECISION,
    "reason" TEXT NOT NULL,
    "currentResultPct" DOUBLE PRECISION,
    "result1dPct" DOUBLE PRECISION,
    "result7dPct" DOUBLE PRECISION,
    "result30dPct" DOUBLE PRECISION,
    "maePct" DOUBLE PRECISION,
    "mfePct" DOUBLE PRECISION,
    "ruleFollowed" BOOLEAN NOT NULL DEFAULT true,
    "status" "PaperSignalStatus" NOT NULL DEFAULT 'OPEN',
    "closedAt" TIMESTAMP(3),
    "closeReason" TEXT,
    "outcome" "PaperSignalOutcome" NOT NULL DEFAULT 'PENDING',
    "evaluatedAt" TIMESTAMP(3),
    "dataQualityScore" INTEGER,
    "dataSource" TEXT,
    "dataWarnings" TEXT,
    "lastMonitoredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaperSignal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Asset_symbol_key" ON "Asset"("symbol");

-- CreateIndex
CREATE INDEX "HistoricalPrice_assetId_idx" ON "HistoricalPrice"("assetId");

-- CreateIndex
CREATE UNIQUE INDEX "HistoricalPrice_assetId_priceDate_key" ON "HistoricalPrice"("assetId", "priceDate");

-- CreateIndex
CREATE INDEX "Position_assetId_idx" ON "Position"("assetId");

-- CreateIndex
CREATE INDEX "PriceSnapshot_assetId_idx" ON "PriceSnapshot"("assetId");

-- CreateIndex
CREATE INDEX "PriceSnapshot_capturedAt_idx" ON "PriceSnapshot"("capturedAt");

-- CreateIndex
CREATE UNIQUE INDEX "OrderIntent_idempotencyKey_key" ON "OrderIntent"("idempotencyKey");

-- CreateIndex
CREATE INDEX "OrderIntent_assetId_idx" ON "OrderIntent"("assetId");

-- CreateIndex
CREATE INDEX "OrderIntent_journalId_idx" ON "OrderIntent"("journalId");

-- CreateIndex
CREATE INDEX "RiskDecision_orderIntentId_idx" ON "RiskDecision"("orderIntentId");

-- CreateIndex
CREATE INDEX "ExecutionLog_orderIntentId_idx" ON "ExecutionLog"("orderIntentId");

-- CreateIndex
CREATE INDEX "ExecutionLog_idempotencyKey_idx" ON "ExecutionLog"("idempotencyKey");

-- CreateIndex
CREATE INDEX "AuditLog_entity_idx" ON "AuditLog"("entity");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "BrokerAccountSnapshot_mode_idx" ON "BrokerAccountSnapshot"("mode");

-- CreateIndex
CREATE INDEX "BrokerAccountSnapshot_capturedAt_idx" ON "BrokerAccountSnapshot"("capturedAt");

-- CreateIndex
CREATE UNIQUE INDEX "PortfolioSnapshot_snapshotDate_key" ON "PortfolioSnapshot"("snapshotDate");

-- CreateIndex
CREATE UNIQUE INDEX "MonthlyReport_monthKey_key" ON "MonthlyReport"("monthKey");

-- CreateIndex
CREATE INDEX "Strategy_status_idx" ON "Strategy"("status");

-- CreateIndex
CREATE INDEX "Strategy_primaryAssetId_idx" ON "Strategy"("primaryAssetId");

-- CreateIndex
CREATE INDEX "BacktestRun_strategyId_idx" ON "BacktestRun"("strategyId");

-- CreateIndex
CREATE INDEX "BacktestRun_assetId_idx" ON "BacktestRun"("assetId");

-- CreateIndex
CREATE INDEX "BacktestRun_createdAt_idx" ON "BacktestRun"("createdAt");

-- CreateIndex
CREATE INDEX "BacktestTrade_backtestRunId_idx" ON "BacktestTrade"("backtestRunId");

-- CreateIndex
CREATE INDEX "PaperSignal_strategyId_idx" ON "PaperSignal"("strategyId");

-- CreateIndex
CREATE INDEX "PaperSignal_assetId_idx" ON "PaperSignal"("assetId");

-- CreateIndex
CREATE INDEX "PaperSignal_status_idx" ON "PaperSignal"("status");

-- CreateIndex
CREATE INDEX "PaperSignal_signalDate_idx" ON "PaperSignal"("signalDate");

-- CreateIndex
CREATE UNIQUE INDEX "PaperSignal_strategyId_assetId_signalDate_reason_key" ON "PaperSignal"("strategyId", "assetId", "signalDate", "reason");

-- AddForeignKey
ALTER TABLE "HistoricalPrice" ADD CONSTRAINT "HistoricalPrice_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Position" ADD CONSTRAINT "Position_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceSnapshot" ADD CONSTRAINT "PriceSnapshot_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderIntent" ADD CONSTRAINT "OrderIntent_journalId_fkey" FOREIGN KEY ("journalId") REFERENCES "TradeJournal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderIntent" ADD CONSTRAINT "OrderIntent_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskDecision" ADD CONSTRAINT "RiskDecision_orderIntentId_fkey" FOREIGN KEY ("orderIntentId") REFERENCES "OrderIntent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExecutionLog" ADD CONSTRAINT "ExecutionLog_orderIntentId_fkey" FOREIGN KEY ("orderIntentId") REFERENCES "OrderIntent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Strategy" ADD CONSTRAINT "Strategy_primaryAssetId_fkey" FOREIGN KEY ("primaryAssetId") REFERENCES "Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BacktestRun" ADD CONSTRAINT "BacktestRun_strategyId_fkey" FOREIGN KEY ("strategyId") REFERENCES "Strategy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BacktestRun" ADD CONSTRAINT "BacktestRun_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BacktestTrade" ADD CONSTRAINT "BacktestTrade_backtestRunId_fkey" FOREIGN KEY ("backtestRunId") REFERENCES "BacktestRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaperSignal" ADD CONSTRAINT "PaperSignal_strategyId_fkey" FOREIGN KEY ("strategyId") REFERENCES "Strategy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaperSignal" ADD CONSTRAINT "PaperSignal_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
