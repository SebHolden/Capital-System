import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  disconnectPaperFixtures,
  getPaperTestPrisma,
  seedPaperFixtures,
  setupPaperTestDatabase,
} from "@/lib/test/paperFixtures";

vi.mock("@/lib/db", () => ({
  get prisma() {
    return getPaperTestPrisma();
  },
}));

import { buildStrategyRanking, getPaperStrategyRankings } from "./rankings";

describe("paper strategy rankings", () => {
  beforeAll(() => {
    setupPaperTestDatabase("test-paper-rankings.db");
  });

  beforeEach(async () => {
    await seedPaperFixtures();
  });

  afterAll(async () => {
    await disconnectPaperFixtures();
  });

  it("aggregates strategy metrics and promotion readiness", async () => {
    const strategy = await getPaperTestPrisma().strategy.findFirstOrThrow();
    const asset = await getPaperTestPrisma().asset.findFirstOrThrow();

    await getPaperTestPrisma().paperSignal.createMany({
      data: [
        {
          strategyId: strategy.id,
          assetId: asset.id,
          signalDate: new Date("2026-01-01T12:00:00.000Z"),
          signalType: "BUY",
          plannedEntry: 100,
          reason: "DCA_MONTHLY",
          result30dPct: 4,
          result1dPct: 1,
          ruleFollowed: true,
          outcome: "WIN",
          status: "CLOSED",
        },
        {
          strategyId: strategy.id,
          assetId: asset.id,
          signalDate: new Date("2026-02-01T12:00:00.000Z"),
          signalType: "BUY",
          plannedEntry: 100,
          reason: "DCA_MONTHLY",
          result30dPct: 6,
          result1dPct: 2,
          ruleFollowed: true,
          outcome: "WIN",
          status: "CLOSED",
        },
        {
          strategyId: strategy.id,
          assetId: asset.id,
          signalDate: new Date("2026-03-01T12:00:00.000Z"),
          signalType: "BUY",
          plannedEntry: 100,
          reason: "DCA_MONTHLY",
          result30dPct: 5,
          result1dPct: 1.5,
          ruleFollowed: true,
          outcome: "WIN",
          status: "OPEN",
        },
      ],
    });

    const ranking = buildStrategyRanking(
      { id: strategy.id, name: strategy.name, status: strategy.status },
      await getPaperTestPrisma().paperSignal.findMany({ where: { strategyId: strategy.id } }),
    );

    expect(ranking.signalCount).toBe(3);
    expect(ranking.closedCount).toBe(2);
    expect(ranking.openCount).toBe(1);
    expect(ranking.avg30dPct).toBeCloseTo(5);
    expect(ranking.avg1dPct).toBeCloseTo(1.5);
    expect(ranking.winCount).toBe(3);
    expect(ranking.winRate).toBe(100);
    expect(ranking.score).toBeGreaterThan(50);
    expect(ranking.rating).toBeDefined();
    expect(ranking.evaluatedCount).toBe(3);
  });

  it("returns sorted rankings from database", async () => {
    const strategy = await getPaperTestPrisma().strategy.findFirstOrThrow();
    const asset = await getPaperTestPrisma().asset.findFirstOrThrow();

    await getPaperTestPrisma().paperSignal.create({
      data: {
        strategyId: strategy.id,
        assetId: asset.id,
        signalDate: new Date("2026-01-01T12:00:00.000Z"),
        signalType: "BUY",
        plannedEntry: 100,
        reason: "DCA_MONTHLY",
        result30dPct: 2,
        status: "CLOSED",
        ruleFollowed: true,
      },
    });

    const rankings = await getPaperStrategyRankings();
    expect(rankings.length).toBe(1);
    expect(rankings[0]?.strategyId).toBe(strategy.id);
  });
});
