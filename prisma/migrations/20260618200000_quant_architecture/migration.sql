-- AlterTable
ALTER TABLE "UserSettings" ADD COLUMN "rejectedOrderCooldownMinutes" INTEGER NOT NULL DEFAULT 15;
ALTER TABLE "UserSettings" ADD COLUMN "rejectAveragingDown" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "HistoricalPrice" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "assetId" TEXT NOT NULL,
    "priceDate" TEXT NOT NULL,
    "close" REAL NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'import',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "HistoricalPrice_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "HistoricalPrice_assetId_idx" ON "HistoricalPrice"("assetId");

-- CreateIndex
CREATE UNIQUE INDEX "HistoricalPrice_assetId_priceDate_key" ON "HistoricalPrice"("assetId", "priceDate");
