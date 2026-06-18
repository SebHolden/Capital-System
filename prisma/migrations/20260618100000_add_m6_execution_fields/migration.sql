-- AlterTable
ALTER TABLE "OrderIntent" ADD COLUMN "idempotencyKey" TEXT;
ALTER TABLE "OrderIntent" ADD COLUMN "executionMode" TEXT;

-- AlterTable
ALTER TABLE "ExecutionLog" ADD COLUMN "brokerOrderId" TEXT;
ALTER TABLE "ExecutionLog" ADD COLUMN "idempotencyKey" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "OrderIntent_idempotencyKey_key" ON "OrderIntent"("idempotencyKey");

-- CreateIndex
CREATE INDEX "ExecutionLog_idempotencyKey_idx" ON "ExecutionLog"("idempotencyKey");
