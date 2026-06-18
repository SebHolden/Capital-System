import { describe, expect, it } from "vitest";
import {
  CLOSE_REASON_EXPIRED,
  CLOSE_REASON_HORIZON_30D,
  CLOSE_REASON_OPPOSITE_SIGNAL,
  isOppositeSignalType,
  resolveSignalStatus,
} from "./lifecycle";

describe("paper signal lifecycle", () => {
  const signalDate = new Date("2026-01-01T12:00:00.000Z");

  it("detects opposite signal types", () => {
    expect(isOppositeSignalType("BUY", "SELL")).toBe(true);
    expect(isOppositeSignalType("SELL", "BUY")).toBe(true);
    expect(isOppositeSignalType("BUY", "BUY")).toBe(false);
    expect(isOppositeSignalType("HOLD", "BUY")).toBe(false);
  });

  it("closes on opposite signal", () => {
    const now = new Date("2026-01-10T12:00:00.000Z");
    const result = resolveSignalStatus({
      currentStatus: "OPEN",
      signalDate,
      result30dPct: null,
      now,
      hasOppositeSignal: true,
    });

    expect(result.status).toBe("CLOSED");
    expect(result.closeReason).toBe(CLOSE_REASON_OPPOSITE_SIGNAL);
    expect(result.closedAt).toEqual(now);
  });

  it("closes on 30d horizon", () => {
    const now = new Date("2026-02-05T12:00:00.000Z");
    const result = resolveSignalStatus({
      currentStatus: "OPEN",
      signalDate,
      result30dPct: 3.5,
      now,
      hasOppositeSignal: false,
    });

    expect(result.status).toBe("CLOSED");
    expect(result.closeReason).toBe(CLOSE_REASON_HORIZON_30D);
  });

  it("expires after 90 days", () => {
    const now = new Date("2026-04-15T12:00:00.000Z");
    const result = resolveSignalStatus({
      currentStatus: "OPEN",
      signalDate,
      result30dPct: null,
      now,
      hasOppositeSignal: false,
    });

    expect(result.status).toBe("EXPIRED");
    expect(result.closeReason).toBe(CLOSE_REASON_EXPIRED);
  });

  it("stays open before horizons", () => {
    const now = new Date("2026-01-15T12:00:00.000Z");
    const result = resolveSignalStatus({
      currentStatus: "OPEN",
      signalDate,
      result30dPct: null,
      now,
      hasOppositeSignal: false,
    });

    expect(result.status).toBe("OPEN");
    expect(result.closeReason).toBeNull();
  });

  it("does not change already closed signals", () => {
    const result = resolveSignalStatus({
      currentStatus: "CLOSED",
      signalDate,
      result30dPct: 5,
      now: new Date(),
      hasOppositeSignal: true,
    });

    expect(result.status).toBe("CLOSED");
    expect(result.closeReason).toBeNull();
  });
});
