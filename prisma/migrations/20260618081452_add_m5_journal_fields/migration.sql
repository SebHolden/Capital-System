-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_TradeJournal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "thesis" TEXT NOT NULL,
    "risks" TEXT NOT NULL,
    "invalidation" TEXT NOT NULL,
    "emotionalState" TEXT NOT NULL,
    "timeHorizon" TEXT NOT NULL DEFAULT '',
    "maxAcceptableLoss" REAL NOT NULL DEFAULT 0,
    "exitRule" TEXT NOT NULL DEFAULT '',
    "emotionScore" INTEGER NOT NULL DEFAULT 5,
    "confidenceScore" INTEGER NOT NULL DEFAULT 5,
    "planned" BOOLEAN NOT NULL DEFAULT false,
    "qualityScore" REAL NOT NULL DEFAULT 0,
    "isComplete" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_TradeJournal" ("createdAt", "emotionalState", "id", "invalidation", "isComplete", "risks", "thesis", "title", "updatedAt") SELECT "createdAt", "emotionalState", "id", "invalidation", "isComplete", "risks", "thesis", "title", "updatedAt" FROM "TradeJournal";
DROP TABLE "TradeJournal";
ALTER TABLE "new_TradeJournal" RENAME TO "TradeJournal";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
