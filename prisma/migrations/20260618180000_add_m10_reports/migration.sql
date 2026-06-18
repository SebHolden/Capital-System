-- CreateTable
CREATE TABLE "PortfolioSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "snapshotDate" TEXT NOT NULL,
    "totalValue" REAL NOT NULL,
    "cashBalance" REAL NOT NULL,
    "investedValue" REAL NOT NULL,
    "dailyPnlPct" REAL NOT NULL,
    "monthlyPnlPct" REAL NOT NULL,
    "riskLevel" TEXT NOT NULL,
    "payloadJson" TEXT NOT NULL DEFAULT '{}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "MonthlyReport" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "monthKey" TEXT NOT NULL,
    "decisionQualityScore" REAL NOT NULL,
    "payloadJson" TEXT NOT NULL,
    "generatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "PortfolioSnapshot_snapshotDate_key" ON "PortfolioSnapshot"("snapshotDate");

-- CreateIndex
CREATE UNIQUE INDEX "MonthlyReport_monthKey_key" ON "MonthlyReport"("monthKey");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");
