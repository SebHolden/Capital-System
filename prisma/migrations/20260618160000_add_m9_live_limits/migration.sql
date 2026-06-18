-- AlterTable
ALTER TABLE "UserSettings" ADD COLUMN "maxLiveOrderAmount" REAL NOT NULL DEFAULT 500;
ALTER TABLE "UserSettings" ADD COLUMN "maxDailyLiveAmount" REAL NOT NULL DEFAULT 2000;
