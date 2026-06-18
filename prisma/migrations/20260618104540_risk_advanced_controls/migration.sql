-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Strategy" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "type" TEXT NOT NULL,
    "configJson" TEXT NOT NULL DEFAULT '{}',
    "benchmarkSymbol" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "primaryAssetId" TEXT,
    "paperActiveAt" DATETIME,
    "promotedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Strategy_primaryAssetId_fkey" FOREIGN KEY ("primaryAssetId") REFERENCES "Asset" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Strategy" ("benchmarkSymbol", "configJson", "createdAt", "description", "id", "name", "paperActiveAt", "primaryAssetId", "promotedAt", "status", "type", "updatedAt") SELECT "benchmarkSymbol", "configJson", "createdAt", "description", "id", "name", "paperActiveAt", "primaryAssetId", "promotedAt", "status", "type", "updatedAt" FROM "Strategy";
DROP TABLE "Strategy";
ALTER TABLE "new_Strategy" RENAME TO "Strategy";
CREATE INDEX "Strategy_status_idx" ON "Strategy"("status");
CREATE INDEX "Strategy_primaryAssetId_idx" ON "Strategy"("primaryAssetId");
CREATE TABLE "new_UserSettings" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'default',
    "hypotheticalCapital" REAL NOT NULL DEFAULT 10000,
    "cashBalance" REAL NOT NULL DEFAULT 10000,
    "executionMode" TEXT NOT NULL DEFAULT 'MOCK',
    "killSwitchActive" BOOLEAN NOT NULL DEFAULT false,
    "maxPositionPct" REAL NOT NULL DEFAULT 25,
    "maxBucketPct" REAL NOT NULL DEFAULT 40,
    "maxDailyOrders" INTEGER NOT NULL DEFAULT 3,
    "maxOrderAmount" REAL NOT NULL DEFAULT 1000,
    "minCashReserve" REAL NOT NULL DEFAULT 1000,
    "maxCryptoPct" REAL NOT NULL DEFAULT 15,
    "maxDailyLossPct" REAL NOT NULL DEFAULT 2,
    "maxMonthlyLossPct" REAL NOT NULL DEFAULT 5,
    "maxExperimentalPct" REAL NOT NULL DEFAULT 5,
    "maxDrawdownPct" REAL NOT NULL DEFAULT 15,
    "peakPortfolioValue" REAL NOT NULL DEFAULT 10000,
    "dailyBaselineValue" REAL NOT NULL DEFAULT 10000,
    "dailyBaselineDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "monthlyBaselineValue" REAL NOT NULL DEFAULT 10000,
    "monthlyBaselineKey" TEXT NOT NULL DEFAULT '2026-01',
    "tradingWindowEnabled" BOOLEAN NOT NULL DEFAULT true,
    "tradingStartHour" INTEGER NOT NULL DEFAULT 9,
    "tradingEndHour" INTEGER NOT NULL DEFAULT 18,
    "tradingTimezone" TEXT NOT NULL DEFAULT 'Europe/Rome',
    "maxLiveOrderAmount" REAL NOT NULL DEFAULT 500,
    "maxDailyLiveAmount" REAL NOT NULL DEFAULT 2000,
    "maxMonthlyLiveAmount" REAL NOT NULL DEFAULT 10000,
    "maxSingleCryptoPct" REAL NOT NULL DEFAULT 5,
    "leverageAllowed" BOOLEAN NOT NULL DEFAULT false,
    "maxAssetPumpPct" REAL NOT NULL DEFAULT 15,
    "assetPumpLookbackDays" INTEGER NOT NULL DEFAULT 7,
    "maxAssetVolatilityPct" REAL NOT NULL DEFAULT 80,
    "revengeTradingLossPct" REAL NOT NULL DEFAULT 1,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_UserSettings" ("cashBalance", "dailyBaselineDate", "dailyBaselineValue", "executionMode", "hypotheticalCapital", "id", "killSwitchActive", "maxBucketPct", "maxCryptoPct", "maxDailyLiveAmount", "maxDailyLossPct", "maxDailyOrders", "maxDrawdownPct", "maxExperimentalPct", "maxLiveOrderAmount", "maxMonthlyLiveAmount", "maxMonthlyLossPct", "maxOrderAmount", "maxPositionPct", "minCashReserve", "monthlyBaselineKey", "monthlyBaselineValue", "peakPortfolioValue", "tradingEndHour", "tradingStartHour", "tradingTimezone", "tradingWindowEnabled", "updatedAt") SELECT "cashBalance", "dailyBaselineDate", "dailyBaselineValue", "executionMode", "hypotheticalCapital", "id", "killSwitchActive", "maxBucketPct", "maxCryptoPct", "maxDailyLiveAmount", "maxDailyLossPct", "maxDailyOrders", "maxDrawdownPct", "maxExperimentalPct", "maxLiveOrderAmount", "maxMonthlyLiveAmount", "maxMonthlyLossPct", "maxOrderAmount", "maxPositionPct", "minCashReserve", "monthlyBaselineKey", "monthlyBaselineValue", "peakPortfolioValue", "tradingEndHour", "tradingStartHour", "tradingTimezone", "tradingWindowEnabled", "updatedAt" FROM "UserSettings";
DROP TABLE "UserSettings";
ALTER TABLE "new_UserSettings" RENAME TO "UserSettings";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
