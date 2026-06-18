-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
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
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_UserSettings" ("cashBalance", "executionMode", "hypotheticalCapital", "id", "killSwitchActive", "maxBucketPct", "maxCryptoPct", "maxDailyOrders", "maxOrderAmount", "maxPositionPct", "minCashReserve", "updatedAt") SELECT "cashBalance", "executionMode", "hypotheticalCapital", "id", "killSwitchActive", "maxBucketPct", "maxCryptoPct", "maxDailyOrders", "maxOrderAmount", "maxPositionPct", "minCashReserve", "updatedAt" FROM "UserSettings";
DROP TABLE "UserSettings";
ALTER TABLE "new_UserSettings" RENAME TO "UserSettings";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
