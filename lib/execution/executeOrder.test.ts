import { describe, expect, it, beforeAll, beforeEach, afterEach, afterAll, vi } from "vitest";
import type { ExecutionResult } from "@/lib/brokers/types";
import * as liveGate from "@/lib/execution/liveGate";
import { LivePassphraseError, LivePrerequisiteError } from "@/lib/execution/liveGate";

const placeOrderMock = vi.hoisted(() => vi.fn<() => Promise<ExecutionResult>>());

vi.mock("@/lib/brokers", () => ({
  getBroker: () => ({
    name: "mock-test",
    mode: "MOCK",
    placeOrder: placeOrderMock,
  }),
}));

import { executeOrder } from "@/lib/execution";
import {
  disconnectExecutionFixtures,
  runTestMigrations,
  seedExecutionFixtures,
  testPrisma,
} from "@/lib/test/executionFixtures";

const originalPrismaTransaction = testPrisma.$transaction.bind(testPrisma);

describe("executeOrder safety", () => {
  let assetId: string;
  let journalId: string;

  beforeAll(() => {
    runTestMigrations();
  }, 60_000);

  beforeEach(async () => {
    placeOrderMock.mockReset();
    const fixtures = await seedExecutionFixtures();
    assetId = fixtures.asset.id;
    journalId = fixtures.journal.id;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    testPrisma.$transaction = originalPrismaTransaction;
  });

  afterAll(async () => {
    await disconnectExecutionFixtures();
  });

  function baseInput(idempotencyKey: string) {
    return {
      assetId,
      journalId,
      side: "BUY" as const,
      quantity: 1,
      limitPrice: 100,
      idempotencyKey,
      confirmRisk: true as const,
      mode: "MOCK" as const,
    };
  }

  it("rejects after live prerequisite failure post risk approval", async () => {
    vi.spyOn(liveGate, "assertLiveExecutionAllowed").mockRejectedValue(
      new LivePrerequisiteError("Prerequisiti live non soddisfatti.", [
        "Nessuna strategia in stato PROMOTED.",
      ]),
    );

    const result = await executeOrder({
      ...baseInput("live-fail-key01"),
      mode: "LIVE",
      confirmLive: true,
      livePassphrase: "secret",
    });

    expect(result.execution?.success).toBe(false);
    expect(result.orderIntentId).toBeDefined();

    const intent = await testPrisma.orderIntent.findUniqueOrThrow({
      where: { id: result.orderIntentId! },
    });
    expect(intent.status).toBe("REJECTED");

    const log = await testPrisma.executionLog.findFirst({
      where: { orderIntentId: intent.id },
    });
    expect(log?.status).toBe("REJECTED");

    const audit = await testPrisma.auditLog.findFirst({
      where: { action: "LIVE_GATE_REJECTED", entityId: intent.id },
    });
    expect(audit).not.toBeNull();
    expect(placeOrderMock).not.toHaveBeenCalled();
  });

  it("rejects after invalid live passphrase post risk approval", async () => {
    vi.spyOn(liveGate, "assertLiveExecutionAllowed").mockRejectedValue(
      new LivePassphraseError(),
    );

    const result = await executeOrder({
      ...baseInput("live-pass-key01"),
      mode: "LIVE",
      confirmLive: true,
      livePassphrase: "wrong",
    });

    expect(result.execution?.success).toBe(false);

    const intent = await testPrisma.orderIntent.findUniqueOrThrow({
      where: { id: result.orderIntentId! },
    });
    expect(intent.status).toBe("REJECTED");

    const audit = await testPrisma.auditLog.findFirst({
      where: { action: "LIVE_PASSPHRASE_REJECTED", entityId: intent.id },
    });
    expect(audit).not.toBeNull();
    expect(placeOrderMock).not.toHaveBeenCalled();
  });

  it("replays rejected order idempotently without second broker call", async () => {
    placeOrderMock.mockResolvedValue({
      success: false,
      fillPrice: null,
      message: "Broker rifiutato.",
      brokerName: "mock-test",
    });

    const key = "idempotent-reject1";
    const first = await executeOrder(baseInput(key));
    expect(first.execution?.success).toBe(false);

    placeOrderMock.mockClear();
    const second = await executeOrder(baseInput(key));

    expect(second.idempotentReplay).toBe(true);
    expect(second.execution?.success).toBe(false);
    expect(placeOrderMock).not.toHaveBeenCalled();

    const logs = await testPrisma.executionLog.findMany({
      where: { idempotencyKey: key },
    });
    expect(logs).toHaveLength(1);
  });

  it("replays broker rejection message from execution log", async () => {
    const rejectMessage = "Broker rifiutato per limite interno.";
    placeOrderMock.mockResolvedValue({
      success: false,
      fillPrice: null,
      message: rejectMessage,
      brokerName: "mock-test",
    });

    const key = "replay-msg-reject1";
    await executeOrder(baseInput(key));
    placeOrderMock.mockClear();

    const replay = await executeOrder(baseInput(key));

    expect(replay.idempotentReplay).toBe(true);
    expect(replay.execution?.success).toBe(false);
    expect(replay.execution?.message).toBe(rejectMessage);
    expect(placeOrderMock).not.toHaveBeenCalled();
  });

  it("marks broker failure as REJECTED without portfolio change", async () => {
    const settingsBefore = await testPrisma.userSettings.findUniqueOrThrow({
      where: { id: "default" },
    });

    placeOrderMock.mockResolvedValue({
      success: false,
      fillPrice: null,
      message: "Quantità non valida.",
      brokerName: "mock-test",
    });

    const result = await executeOrder(baseInput("broker-fail-key1"));

    expect(result.execution?.success).toBe(false);

    const intent = await testPrisma.orderIntent.findUniqueOrThrow({
      where: { id: result.orderIntentId! },
    });
    expect(intent.status).toBe("REJECTED");

    const settingsAfter = await testPrisma.userSettings.findUniqueOrThrow({
      where: { id: "default" },
    });
    expect(settingsAfter.cashBalance).toBe(settingsBefore.cashBalance);
  });

  it("marks broker throw as REJECTED with audit", async () => {
    placeOrderMock.mockRejectedValue(new Error("Network timeout"));

    const result = await executeOrder(baseInput("broker-throw-key"));

    expect(result.execution?.success).toBe(false);

    const intent = await testPrisma.orderIntent.findUniqueOrThrow({
      where: { id: result.orderIntentId! },
    });
    expect(intent.status).toBe("REJECTED");

    const audit = await testPrisma.auditLog.findFirst({
      where: { action: "BROKER_ERROR", entityId: intent.id },
    });
    expect(audit).not.toBeNull();
  });

  it("does not duplicate execution for same idempotencyKey", async () => {
    placeOrderMock.mockResolvedValue({
      success: true,
      fillPrice: 100,
      message: "Filled",
      brokerOrderId: "mock-dup",
      brokerName: "mock-test",
    });

    const key = "no-dup-exec-key1";
    await executeOrder(baseInput(key));
    placeOrderMock.mockClear();

    const replay = await executeOrder(baseInput(key));

    expect(replay.idempotentReplay).toBe(true);
    expect(placeOrderMock).not.toHaveBeenCalled();

    const logs = await testPrisma.executionLog.findMany({
      where: { idempotencyKey: key },
    });
    expect(logs).toHaveLength(1);
  });

  it("does not leave PENDING when reject persistence fails after broker rejection", async () => {
    placeOrderMock.mockResolvedValue({
      success: false,
      fillPrice: null,
      message: "Broker rifiutato.",
      brokerName: "mock-test",
    });

    const originalTx = originalPrismaTransaction;
    let txCalls = 0;
    const txSpy = vi
      .spyOn(testPrisma, "$transaction")
      .mockImplementation((fn) => {
        txCalls += 1;
        if (txCalls === 2) {
          return Promise.reject(new Error("Simulated reject DB failure"));
        }
        return originalTx(fn as Parameters<typeof testPrisma.$transaction>[0]);
      });

    try {
      const result = await executeOrder(baseInput("db-fail-broker-rej"));

      expect(result.execution?.success).toBe(false);

      const intent = await testPrisma.orderIntent.findUniqueOrThrow({
        where: { id: result.orderIntentId! },
      });
      expect(intent.status).toBe("REJECTED");

      const audit = await testPrisma.auditLog.findFirst({
        where: { action: "EXECUTION_REJECT_FAILED", entityId: intent.id },
      });
      expect(audit).not.toBeNull();
    } finally {
      txSpy.mockRestore();
    }
  });

  it("handles DB failure after broker success via reject path", async () => {
    placeOrderMock.mockResolvedValue({
      success: true,
      fillPrice: 100,
      message: "Filled",
      brokerOrderId: "mock-123",
      brokerName: "mock-test",
    });

    const originalTx = originalPrismaTransaction;
    const txSpy = vi
      .spyOn(testPrisma, "$transaction")
      .mockImplementationOnce((fn) =>
        originalTx(fn as Parameters<typeof testPrisma.$transaction>[0]),
      )
      .mockImplementationOnce(() =>
        Promise.reject(new Error("Simulated DB failure")),
      )
      .mockImplementation((fn) =>
        originalTx(fn as Parameters<typeof testPrisma.$transaction>[0]),
      );

    try {
      const result = await executeOrder(baseInput("db-fail-after-fill"));

      expect(result.execution?.success).toBe(false);

      const intent = await testPrisma.orderIntent.findUniqueOrThrow({
        where: { id: result.orderIntentId! },
      });
      expect(intent.status).toBe("REJECTED");
    } finally {
      txSpy.mockRestore();
    }
  });
});

describe("executeOrder idempotency incomplete", () => {
  beforeEach(async () => {
    await seedExecutionFixtures();
  });

  it("returns safe incomplete replay for PENDING intent without execution log", async () => {
    const { findExistingExecution } = await import("@/lib/execution/idempotency");

    await testPrisma.orderIntent.create({
      data: {
        assetId: (await testPrisma.asset.findFirstOrThrow()).id,
        side: "BUY",
        quantity: 1,
        limitPrice: 100,
        status: "PENDING",
        idempotencyKey: "pending-no-log01",
        executionMode: "MOCK",
      },
    });

    const replay = await findExistingExecution("pending-no-log01");
    expect(replay).not.toBeNull();
    expect(replay?.executionIncomplete).toBe(true);
    expect(replay?.execution?.success).toBe(false);
    expect(replay?.idempotentReplay).toBe(true);
  });
});
