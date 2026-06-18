import type { PrismaClient, UserSettings } from "@prisma/client";
import { prisma as defaultPrisma } from "@/lib/db";
import { computeDrawdown } from "./drawdown";
import {
  computePeriodLoss,
  lossBudgetRemaining,
  type PeriodLoss,
} from "./lossLimits";

export interface RiskBaselineMetrics {
  daily: PeriodLoss;
  monthly: PeriodLoss;
  dailyLossBudgetRemainingPct: number;
  monthlyLossBudgetRemainingPct: number;
  drawdown: ReturnType<typeof computeDrawdown>;
}

function getDateKeyInTimezone(timezone: string, now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

function getMonthKeyInTimezone(timezone: string, now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
  }).formatToParts(now);
  const year = parts.find((p) => p.type === "year")?.value ?? "1970";
  const month = parts.find((p) => p.type === "month")?.value ?? "01";
  return `${year}-${month}`;
}

export function computeRiskMetrics(
  settings: UserSettings,
  currentTotalValue: number,
): RiskBaselineMetrics {
  const daily = computePeriodLoss(
    settings.dailyBaselineValue,
    currentTotalValue,
  );
  const monthly = computePeriodLoss(
    settings.monthlyBaselineValue,
    currentTotalValue,
  );
  const drawdown = computeDrawdown(
    settings.peakPortfolioValue,
    currentTotalValue,
  );

  return {
    daily,
    monthly,
    dailyLossBudgetRemainingPct: lossBudgetRemaining(
      daily.lossPct,
      settings.maxDailyLossPct,
    ),
    monthlyLossBudgetRemainingPct: lossBudgetRemaining(
      monthly.lossPct,
      settings.maxMonthlyLossPct,
    ),
    drawdown,
  };
}

export function buildBaselineUpdates(
  settings: UserSettings,
  currentTotalValue: number,
  now = new Date(),
): Partial<UserSettings> {
  const timezone = settings.tradingTimezone;
  const todayKey = getDateKeyInTimezone(timezone, now);
  const monthKey = getMonthKeyInTimezone(timezone, now);
  const storedDayKey = getDateKeyInTimezone(
    timezone,
    settings.dailyBaselineDate,
  );

  const updates: Partial<UserSettings> = {};

  if (todayKey !== storedDayKey) {
    updates.dailyBaselineValue = currentTotalValue;
    updates.dailyBaselineDate = now;
  }

  if (monthKey !== settings.monthlyBaselineKey) {
    updates.monthlyBaselineValue = currentTotalValue;
    updates.monthlyBaselineKey = monthKey;
  }

  if (currentTotalValue > settings.peakPortfolioValue) {
    updates.peakPortfolioValue = currentTotalValue;
  }

  return updates;
}

export async function syncRiskBaselines(
  settings: UserSettings,
  currentTotalValue: number,
  client: PrismaClient = defaultPrisma,
  now = new Date(),
): Promise<{ settings: UserSettings; metrics: RiskBaselineMetrics }> {
  const updates = buildBaselineUpdates(settings, currentTotalValue, now);

  let synced = settings;
  if (Object.keys(updates).length > 0) {
    synced = await client.userSettings.update({
      where: { id: settings.id },
      data: updates,
    });
  }

  const metrics = computeRiskMetrics(synced, currentTotalValue);
  return { settings: synced, metrics };
}
