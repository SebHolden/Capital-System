import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  disconnectPaperFixtures,
  runPaperTestMigrations,
  seedPaperFixtures,
  testPrisma,
} from "@/lib/test/paperFixtures";
import { buildStrategyRanking, getPaperStrategyRankings } from "./rankings";

describe("paper strategy rankings", () => {
  beforeAll(() => {
    process.env.DATABASE_URL = "file:./prisma/test-paper-rankings.db";
    runPaperTestMigrations();
  });

  beforeEach(async () => {
    await seedPaperFixtures();
  });

  afterAll(async () => {
    await disconnectPaperFixtures();
  });

  it("aggregates strategy metrics and promotion readiness", async () => {
    const strategy = await testPrisma.strategy.findFirstOrThrow();
    const asset = await testPrisma.asset.findFirstOrThrow();

    await testPrisma.paperSignal.createMany({
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
          status: "OPEN",
        },
      ],
    });

    const ranking = buildStrategyRanking(
      { id: strategy.id, name: strategy.name, status: strategy.status },
      await testPrisma.paperSignal.findMany({ where: { strategyId: strategy.id } }),
    );

    expect(ranking.signalCount).toBe(3);
    expect(ranking.closedCount).toBe(2);
    expect(ranking.openCount).toBe(1);
    expect(ranking.avg30dPct).toBeCloseTo(5);
    expect(ranking.avg1dPct).toBeCloseTo(1.5);
    expect(ranking.ruleFollowedPct).toBe(100);
    expect(ranking.promotionReady).toBe(true);
  });

  it("returns sorted rankings from database", async () => {
    const strategy = await testPrisma.strategy.findFirstOrThrow();
    const asset = await testPrisma.asset.findFirstOrThrow();

    await testPrisma.paperSignal.create({
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
