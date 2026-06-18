-- CreateTable
CREATE TABLE "BrokerAccountSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "brokerName" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "accountId" TEXT,
    "equity" REAL NOT NULL,
    "cash" REAL NOT NULL,
    "buyingPower" REAL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "payloadJson" TEXT NOT NULL DEFAULT '{}',
    "capturedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "BrokerAccountSnapshot_brokerName_mode_idx" ON "BrokerAccountSnapshot"("brokerName", "mode");

-- CreateIndex
CREATE INDEX "BrokerAccountSnapshot_capturedAt_idx" ON "BrokerAccountSnapshot"("capturedAt");
