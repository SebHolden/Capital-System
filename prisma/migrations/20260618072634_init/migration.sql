-- CreateTable
CREATE TABLE "UserSettings" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'default',
    "hypotheticalCapital" REAL NOT NULL DEFAULT 10000,
    "cashBalance" REAL NOT NULL DEFAULT 10000,
    "executionMode" TEXT NOT NULL DEFAULT 'MOCK',
    "killSwitchActive" BOOLEAN NOT NULL DEFAULT false,
    "maxPositionPct" REAL NOT NULL DEFAULT 25,
    "maxBucketPct" REAL NOT NULL DEFAULT 40,
    "maxDailyOrders" INTEGER NOT NULL DEFAULT 3,
    "maxOrderAmount" REAL NOT NULL DEFAULT 1000,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Asset" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "symbol" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "assetType" TEXT NOT NULL DEFAULT 'ETF',
    "bucket" TEXT NOT NULL DEFAULT 'CORE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Position" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "assetId" TEXT NOT NULL,
    "quantity" REAL NOT NULL,
    "avgPrice" REAL NOT NULL,
    "bucket" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Position_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PriceSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "assetId" TEXT NOT NULL,
    "price" REAL NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "capturedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PriceSnapshot_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TradeJournal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "thesis" TEXT NOT NULL,
    "risks" TEXT NOT NULL,
    "invalidation" TEXT NOT NULL,
    "emotionalState" TEXT NOT NULL,
    "isComplete" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "OrderIntent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "journalId" TEXT,
    "assetId" TEXT NOT NULL,
    "side" TEXT NOT NULL,
    "quantity" REAL NOT NULL,
    "limitPrice" REAL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OrderIntent_journalId_fkey" FOREIGN KEY ("journalId") REFERENCES "TradeJournal" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "OrderIntent_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RiskDecision" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderIntentId" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "reasons" TEXT NOT NULL,
    "blocked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RiskDecision_orderIntentId_fkey" FOREIGN KEY ("orderIntentId") REFERENCES "OrderIntent" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ExecutionLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderIntentId" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "fillPrice" REAL,
    "message" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ExecutionLog_orderIntentId_fkey" FOREIGN KEY ("orderIntentId") REFERENCES "OrderIntent" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "payload" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "Asset_symbol_key" ON "Asset"("symbol");

-- CreateIndex
CREATE INDEX "Position_assetId_idx" ON "Position"("assetId");

-- CreateIndex
CREATE INDEX "PriceSnapshot_assetId_idx" ON "PriceSnapshot"("assetId");

-- CreateIndex
CREATE INDEX "OrderIntent_assetId_idx" ON "OrderIntent"("assetId");

-- CreateIndex
CREATE INDEX "OrderIntent_journalId_idx" ON "OrderIntent"("journalId");

-- CreateIndex
CREATE INDEX "RiskDecision_orderIntentId_idx" ON "RiskDecision"("orderIntentId");

-- CreateIndex
CREATE INDEX "ExecutionLog_orderIntentId_idx" ON "ExecutionLog"("orderIntentId");

-- CreateIndex
CREATE INDEX "AuditLog_entity_idx" ON "AuditLog"("entity");
