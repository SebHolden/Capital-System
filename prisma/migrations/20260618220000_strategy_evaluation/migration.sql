-- AlterTable
ALTER TABLE "PaperSignal" ADD COLUMN "outcome" TEXT NOT NULL DEFAULT 'PENDING';
ALTER TABLE "PaperSignal" ADD COLUMN "evaluatedAt" DATETIME;

-- AlterTable
ALTER TABLE "Strategy" ADD COLUMN "evaluationScore" INTEGER;
ALTER TABLE "Strategy" ADD COLUMN "rating" TEXT;
ALTER TABLE "Strategy" ADD COLUMN "lastEvaluatedAt" DATETIME;
