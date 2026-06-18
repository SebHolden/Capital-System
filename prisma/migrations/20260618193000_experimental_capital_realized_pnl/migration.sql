-- AlterTable
ALTER TABLE "UserSettings" ADD COLUMN "experimentalCapital" REAL NOT NULL DEFAULT 0;
ALTER TABLE "UserSettings" ADD COLUMN "experimentalCashBalance" REAL NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "ExecutionLog" ADD COLUMN "costBasisPerUnit" REAL;
ALTER TABLE "ExecutionLog" ADD COLUMN "realizedPnl" REAL;
