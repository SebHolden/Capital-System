-- CreateTable
CREATE TABLE "Strategy" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "type" TEXT NOT NULL,
    "configJson" TEXT NOT NULL DEFAULT '{}',
    "benchmarkSymbol" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "BacktestRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "strategyId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME NOT NULL,
    "initialCapital" REAL NOT NULL,
    "commissionBps" REAL NOT NULL DEFAULT 10,
    "slippageBps" REAL NOT NULL DEFAULT 10,
    "dataSource" TEXT NOT NULL DEFAULT 'live',
    "metricsJson" TEXT NOT NULL DEFAULT '{}',
    "benchmarkJson" TEXT,
    "equityCurveJson" TEXT NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'COMPLETED',
    "errorMessage" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BacktestRun_strategyId_fkey" FOREIGN KEY ("strategyId") REFERENCES "Strategy" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BacktestRun_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BacktestTrade" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "backtestRunId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "side" TEXT NOT NULL,
    "quantity" REAL NOT NULL,
    "price" REAL NOT NULL,
    "fees" REAL NOT NULL DEFAULT 0,
    "reason" TEXT NOT NULL,
    CONSTRAINT "BacktestTrade_backtestRunId_fkey" FOREIGN KEY ("backtestRunId") REFERENCES "BacktestRun" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "BacktestRun_strategyId_idx" ON "BacktestRun"("strategyId");
CREATE INDEX "BacktestRun_assetId_idx" ON "BacktestRun"("assetId");
CREATE INDEX "BacktestRun_createdAt_idx" ON "BacktestRun"("createdAt");
CREATE INDEX "BacktestTrade_backtestRunId_idx" ON "BacktestTrade"("backtestRunId");
