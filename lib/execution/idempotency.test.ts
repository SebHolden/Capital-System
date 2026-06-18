import { describe, expect, it, beforeAll, beforeEach, afterAll } from "vitest";
import { findExistingExecution } from "@/lib/execution/idempotency";
import {
  disconnectExecutionFixtures,
  runTestMigrations,
  seedExecutionFixtures,
  testPrisma,
} from "@/lib/test/executionFixtures";

describe("findExistingExecution idempotency", () => {
  const originalStaleMs = process.env.PENDING_EXECUTION_STALE_MS;
  const staleMs = 120_000;

  beforeAll(() => {
    runTestMigrations();
  }, 60_000);

  beforeEach(async () => {
    process.env.PENDING_EXECUTION_STALE_MS = String(staleMs);
    await seedExecutionFixtures();
  });

  afterAll(async () => {
    if (originalStaleMs === undefined) {
      delete process.env.PENDING_EXECUTION_STALE_MS;
    } else {
      process.env.PENDING_EXECUTION_STALE_MS = originalStaleMs;
    }
    await disconnectExecutionFixtures();
  });

  async function assetId() {
    return (await testPrisma.asset.findFirstOrThrow()).id;
  }

  it("returns executionIncomplete for young PENDING without execution log", async () => {
    await testPrisma.orderIntent.create({
      data: {
        assetId: await assetId(),
        side: "BUY",
        quantity: 1,
        limitPrice: 100,
        status: "PENDING",
        idempotencyKey: "pending-young01",
        executionMode: "MOCK",
        createdAt: new Date(),
      },
    });

    const replay = await findExistingExecution("pending-young01");

    expect(replay).not.toBeNull();
    expect(replay?.executionIncomplete).toBe(true);
    expect(replay?.execution?.success).toBe(false);
    expect(replay?.idempotentReplay).toBe(true);

    const intent = await testPrisma.orderIntent.findUniqueOrThrow({
      where: { idempotencyKey: "pending-young01" },
    });
    expect(intent.status).toBe("PENDING");
  });

  it("rejects stale PENDING without execution log with audit and coherent replay", async () => {
    const createdAt = new Date(Date.now() - staleMs - 1_000);

    await testPrisma.orderIntent.create({
      data: {
        assetId: await assetId(),
        side: "BUY",
        quantity: 1,
        limitPrice: 100,
        status: "PENDING",
        idempotencyKey: "pending-stale01",
        executionMode: "MOCK",
        createdAt,
      },
    });

    const replay = await findExistingExecution("pending-stale01");

    expect(replay).not.toBeNull();
    expect(replay?.idempotentReplay).toBe(true);
    expect(replay?.execution?.success).toBe(false);
    expect(replay?.riskDecision.blocked).toBe(true);
    expect(replay?.execution?.message).toContain("soglia");

    const intent = await testPrisma.orderIntent.findUniqueOrThrow({
      where: { idempotencyKey: "pending-stale01" },
    });
    expect(intent.status).toBe("REJECTED");

    const log = await testPrisma.executionLog.findFirst({
      where: { orderIntentId: intent.id },
    });
    expect(log?.status).toBe("REJECTED");

    const audit = await testPrisma.auditLog.findFirst({
      where: { action: "EXECUTION_STALE_PENDING", entityId: intent.id },
    });
    expect(audit).not.toBeNull();

    const secondReplay = await findExistingExecution("pending-stale01");
    expect(secondReplay?.idempotentReplay).toBe(true);
    expect(secondReplay?.execution?.success).toBe(false);
    expect(secondReplay?.riskDecision.blocked).toBe(true);
  });

  it("returns coherent replay for REJECTED risk-gate without execution log", async () => {
    const intent = await testPrisma.orderIntent.create({
      data: {
        assetId: await assetId(),
        side: "BUY",
        quantity: 1,
        limitPrice: 100,
        status: "REJECTED",
        idempotencyKey: "risk-reject01",
        executionMode: "MOCK",
      },
    });

    await testPrisma.riskDecision.create({
      data: {
        orderIntentId: intent.id,
        level: "RED",
        blocked: true,
        reasons: JSON.stringify({
          reasons: ["Limite giornaliero superato."],
          warnings: [],
          allowedAmount: 0,
        }),
      },
    });

    const replay = await findExistingExecution("risk-reject01");

    expect(replay).not.toBeNull();
    expect(replay?.idempotentReplay).toBe(true);
    expect(replay?.riskDecision.blocked).toBe(true);
    expect(replay?.riskDecision.reasons).toContain("Limite giornaliero superato.");
    expect(replay?.execution?.success).toBe(false);
    expect(replay?.execution?.message).toBe("Rifiutato dal risk gate.");
  });
});
