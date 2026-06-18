-- AlterTable
ALTER TABLE "Strategy" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'DRAFT';
ALTER TABLE "Strategy" ADD COLUMN "primaryAssetId" TEXT;
ALTER TABLE "Strategy" ADD COLUMN "paperActiveAt" DATETIME;
ALTER TABLE "Strategy" ADD COLUMN "promotedAt" DATETIME;

-- CreateTable
CREATE TABLE "PaperSignal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "strategyId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "signalDate" DATETIME NOT NULL,
    "signalType" TEXT NOT NULL,
    "plannedEntry" REAL NOT NULL,
    "amountEur" REAL,
    "quantity" REAL,
    "reason" TEXT NOT NULL,
    "currentResultPct" REAL,
    "result7dPct" REAL,
    "result30dPct" REAL,
    "maePct" REAL,
    "mfePct" REAL,
    "ruleFollowed" BOOLEAN NOT NULL DEFAULT true,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "lastMonitoredAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PaperSignal_strategyId_fkey" FOREIGN KEY ("strategyId") REFERENCES "Strategy" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PaperSignal_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Strategy_status_idx" ON "Strategy"("status");
CREATE INDEX "Strategy_primaryAssetId_idx" ON "Strategy"("primaryAssetId");
CREATE INDEX "PaperSignal_strategyId_idx" ON "PaperSignal"("strategyId");
CREATE INDEX "PaperSignal_assetId_idx" ON "PaperSignal"("assetId");
CREATE INDEX "PaperSignal_status_idx" ON "PaperSignal"("status");
CREATE INDEX "PaperSignal_signalDate_idx" ON "PaperSignal"("signalDate");
CREATE UNIQUE INDEX "PaperSignal_strategyId_assetId_signalDate_reason_key" ON "PaperSignal"("strategyId", "assetId", "signalDate", "reason");
