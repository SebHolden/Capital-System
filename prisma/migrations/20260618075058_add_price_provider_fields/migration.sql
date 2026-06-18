-- AlterTable
ALTER TABLE "Asset" ADD COLUMN "provider" TEXT;
ALTER TABLE "Asset" ADD COLUMN "providerSymbol" TEXT;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_PriceSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "assetId" TEXT NOT NULL,
    "price" REAL NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "status" TEXT NOT NULL DEFAULT 'fresh',
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "capturedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PriceSnapshot_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_PriceSnapshot" ("assetId", "capturedAt", "id", "price", "source") SELECT "assetId", "capturedAt", "id", "price", "source" FROM "PriceSnapshot";
DROP TABLE "PriceSnapshot";
ALTER TABLE "new_PriceSnapshot" RENAME TO "PriceSnapshot";
CREATE INDEX "PriceSnapshot_assetId_idx" ON "PriceSnapshot"("assetId");
CREATE INDEX "PriceSnapshot_capturedAt_idx" ON "PriceSnapshot"("capturedAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
