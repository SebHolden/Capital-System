import { prisma } from "@/lib/db";
import { getJournalQualitySummary } from "@/lib/journal";
import { getUserSettings } from "@/lib/security";
import { findImpulsiveTrades, listOrderActivity } from "./aggregators";
import { buildIntentOutcomes } from "./intentOutcomes";
import type { WeeklyReport } from "./types";
import {
  getDateKeyInTimezone,
  weekBoundsFromStart,
} from "./utils";

export async function buildWeeklyReport(
  weekStartKey?: string,
): Promise<WeeklyReport> {
  const settings = await getUserSettings();
  const weekStart =
    weekStartKey ?? getDateKeyInTimezone(settings.tradingTimezone);
  const { since, until, weekEndKey } = weekBoundsFromStart(weekStart);

  const [snapshots, journalReview, orders, impulsiveTrades, intentOutcomes] =
    await Promise.all([
    prisma.portfolioSnapshot.findMany({
      where: {
        snapshotDate: { gte: weekStart, lte: weekEndKey },
      },
      orderBy: { snapshotDate: "asc" },
    }),
    getJournalQualitySummary(prisma, { since, until }),
    listOrderActivity({ since, until }),
    findImpulsiveTrades({ since, until }),
    buildIntentOutcomes({ since, until }),
  ]);

  const values = snapshots.map((s) => s.totalValue);
  const startValue = values.length > 0 ? values[0] : null;
  const endValue = values.length > 0 ? values[values.length - 1] : null;
  const changePct =
    startValue !== null && endValue !== null && startValue > 0
      ? ((endValue - startValue) / startValue) * 100
      : null;

  const latestSnapshot = snapshots[snapshots.length - 1];
  let exposure: WeeklyReport["exposure"] = null;
  if (latestSnapshot) {
    try {
      const payload = JSON.parse(latestSnapshot.payloadJson) as {
        bucketPcts?: Record<string, number>;
        cryptoPct?: number;
      };
      exposure = {
        bucketPcts: payload.bucketPcts ?? {},
        cryptoPct: payload.cryptoPct ?? 0,
      };
    } catch {
      exposure = null;
    }
  }

  const blockedOrders = orders.filter((o) => o.riskBlocked).length;
  const redJournals = journalReview.levelCounts.RED;

  return {
    type: "weekly",
    weekStart,
    weekEnd: weekEndKey,
    generatedAt: new Date().toISOString(),
    performance: {
      snapshotCount: snapshots.length,
      startValue,
      endValue,
      changePct,
      minValue: values.length > 0 ? Math.min(...values) : null,
      maxValue: values.length > 0 ? Math.max(...values) : null,
    },
    journalReview,
    decisionErrors: {
      blockedOrders,
      redJournals,
      impulsiveTrades,
    },
    exposure,
    intentOutcomes,
  };
}
