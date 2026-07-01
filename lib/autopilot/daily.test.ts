import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  classifyAction,
  generateSuggestedActions,
  buildDailyDecisionBrief,
  runDailyWorkflow,
} from "./daily";
import { SAFETY_MESSAGES } from "./types";

vi.mock("@/lib/db", () => ({
  prisma: {
    paperSignal: {
      count: vi.fn().mockResolvedValue(0),
    },
    strategy: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    auditLog: {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({}),
    },
  },
}));

vi.mock("@/lib/portfolio", () => ({
  getPortfolioSummary: vi.fn().mockResolvedValue({
    portfolio: { totalValue: 10000 },
    riskMetrics: {
      daily: { pnlPct: 0.5 },
      monthly: { pnlPct: 2.1 },
      drawdown: { drawdownPct: 3 },
    },
    risk: {
      level: "GREEN",
      reasons: [],
      warnings: [],
    },
    settings: {
      killSwitchActive: false,
      executionMode: "MOCK",
      maxOrderAmount: 1000,
      tradingTimezone: "Europe/Rome",
    },
    tradingWindow: { allowed: true },
    priceWarnings: [],
    operations: { blocked: [], allowed: ["DCA core"] },
  }),
}));

vi.mock("@/lib/paper-signals", () => ({
  getPaperStrategyRankings: vi.fn().mockResolvedValue([
    {
      strategyId: "s1",
      strategyName: "BTC Buy the Dip",
      status: "PAPER_ACTIVE",
      score: 72,
      rating: "GOOD",
      recommendation: "WATCH",
    },
    {
      strategyId: "s2",
      strategyName: "SWDA DCA mensile",
      status: "PROMOTED",
      score: 88,
      rating: "PROMOTABLE",
      recommendation: "PROMOTE",
    },
  ]),
  runPaperSignalsPipeline: vi.fn().mockResolvedValue({
    generated: { created: 2, skipped: 0 },
    refreshed: { updated: 5 },
    promotion: { promoted: ["s2"] },
    degradation: { degraded: [] },
    evaluationsSynced: 2,
  }),
}));

vi.mock("@/lib/prices/service", () => ({
  refreshPrices: vi.fn().mockResolvedValue({ refreshed: 4, failed: 0, results: [] }),
}));

vi.mock("@/lib/security", () => ({
  getUserSettings: vi.fn().mockResolvedValue({
    executionMode: "MOCK",
    tradingTimezone: "Europe/Rome",
  }),
  isLiveTradingEnabled: vi.fn().mockReturnValue(false),
  writeAuditLog: vi.fn().mockResolvedValue(undefined),
}));

describe("classifyAction", () => {
  it("returns DO_NOTHING when kill switch is active", () => {
    expect(
      classifyAction({
        riskLevel: "GREEN",
        killSwitchActive: true,
        liveTradingEnabled: false,
        hasStalePrices: false,
      }),
    ).toBe("DO_NOTHING");
  });

  it("returns MANUAL_APPROVAL_REQUIRED for core DCA with GREEN risk", () => {
    expect(
      classifyAction({
        riskLevel: "GREEN",
        killSwitchActive: false,
        liveTradingEnabled: false,
        hasStalePrices: false,
        isCoreDca: true,
      }),
    ).toBe("MANUAL_APPROVAL_REQUIRED");
  });

  it("returns REVIEW_MANUALLY for promoted strategies", () => {
    expect(
      classifyAction({
        riskLevel: "GREEN",
        killSwitchActive: false,
        liveTradingEnabled: false,
        hasStalePrices: false,
        strategyPromoted: true,
      }),
    ).toBe("REVIEW_MANUALLY");
  });
});

describe("generateSuggestedActions", () => {
  it("never assigns a classification that implies autonomous live execution", () => {
    const { actions } = generateSuggestedActions({
      riskLevel: "GREEN",
      killSwitchActive: false,
      liveTradingEnabled: false,
      priceWarnings: [],
      rankings: [
        {
          strategyId: "s1",
          strategyName: "BTC Buy the Dip",
          status: "PAPER_ACTIVE",
          score: 72,
          rating: "GOOD",
          recommendation: "WATCH",
        } as never,
      ],
      promotedToday: [],
      degradedToday: [],
      newSignalsToday: 1,
      maxOrderAmount: 1000,
    });

    for (const action of actions) {
      expect(action.classification).not.toBe("LIVE_EXECUTE" as never);
      expect(action.description.toLowerCase()).not.toContain("esegui automaticamente");
    }
  });

  it("marks promoted strategies as analytical only", () => {
    const { actions } = generateSuggestedActions({
      riskLevel: "GREEN",
      killSwitchActive: false,
      liveTradingEnabled: false,
      priceWarnings: [],
      rankings: [
        {
          strategyId: "s2",
          strategyName: "SWDA DCA mensile",
          status: "PROMOTED",
          score: 88,
          rating: "PROMOTABLE",
          recommendation: "PROMOTE",
        } as never,
      ],
      promotedToday: ["s2"],
      degradedToday: [],
      newSignalsToday: 0,
      maxOrderAmount: 250,
    });

    const promotedAction = actions.find((a) => a.strategyName === "SWDA DCA mensile");
    expect(promotedAction?.classification).toBe("REVIEW_MANUALLY");
    expect(promotedAction?.description).toContain("non autorizza live");
  });
});

describe("buildDailyDecisionBrief", () => {
  beforeEach(() => {
    process.env.ENABLE_LIVE_TRADING = "false";
    process.env.BROKER_API_KEY = "super-secret-broker-key";
    process.env.ALPACA_API_SECRET = "super-secret-alpaca";
  });

  it("includes safety notice with required disclaimers", async () => {
    const brief = await buildDailyDecisionBrief();

    expect(brief.safetyNotice.liveTradingDisabled).toBe(true);
    for (const msg of SAFETY_MESSAGES) {
      expect(brief.safetyNotice.messages.some((m) => m.includes(msg.split(" ")[0]))).toBe(
        true,
      );
    }
    expect(brief.safetyNotice.messages.join(" ")).toContain("Paper signals are NOT orders");
    expect(brief.safetyNotice.messages.join(" ")).toContain(
      "Promoted strategy does NOT mean live execution allowed",
    );
  });

  it("does not leak broker secrets in brief payload", async () => {
    const brief = await buildDailyDecisionBrief();
    const serialized = JSON.stringify(brief);

    expect(serialized).not.toContain("super-secret-broker-key");
    expect(serialized).not.toContain("super-secret-alpaca");
  });

  it("limits suggested actions to top 3", async () => {
    const brief = await buildDailyDecisionBrief();
    expect(brief.actions.length).toBeLessThanOrEqual(3);
  });
});

describe("runDailyWorkflow", () => {
  it("runs without live trading enabled", async () => {
    process.env.ENABLE_LIVE_TRADING = "false";

    const { brief, workflow } = await runDailyWorkflow();

    expect(workflow.prices.refreshed).toBe(4);
    expect(workflow.paperSignals.created).toBe(2);
    expect(brief.systemStatus.liveTradingEnabled).toBe(false);
    expect(brief.safetyNotice.liveTradingDisabled).toBe(true);
  });
});
