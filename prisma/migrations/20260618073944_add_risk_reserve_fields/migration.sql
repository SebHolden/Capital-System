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
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_UserSettings" ("cashBalance", "executionMode", "hypotheticalCapital", "id", "killSwitchActive", "maxBucketPct", "maxDailyOrders", "maxOrderAmount", "maxPositionPct", "updatedAt") SELECT "cashBalance", "executionMode", "hypotheticalCapital", "id", "killSwitchActive", "maxBucketPct", "maxDailyOrders", "maxOrderAmount", "maxPositionPct", "updatedAt" FROM "UserSettings";
DROP TABLE "UserSettings";
ALTER TABLE "new_UserSettings" RENAME TO "UserSettings";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
