import { describe, expect, it } from "vitest";
import { classifyOutcome } from "./outcome";

const thresholds = {
  winThresholdPct: 2,
  lossThresholdPct: -2,
  minBarsFor30d: 25,
};

describe("classifyOutcome", () => {
  it("classifies BUY WIN when 30d above threshold", () => {
    expect(
      classifyOutcome({
        signalType: "BUY",
        result30dPct: 3.5,
        result7dPct: 1,
        status: "CLOSED",
        barsAfterSignal: 30,
        thresholds,
      }),
    ).toBe("WIN");
  });

  it("classifies BUY LOSS when 30d below threshold", () => {
    expect(
      classifyOutcome({
        signalType: "BUY",
        result30dPct: -4,
        result7dPct: -1,
        status: "CLOSED",
        barsAfterSignal: 30,
        thresholds,
      }),
    ).toBe("LOSS");
  });

  it("classifies FLAT for small movement", () => {
    expect(
      classifyOutcome({
        signalType: "BUY",
        result30dPct: 0.5,
        result7dPct: 0.2,
        status: "CLOSED",
        barsAfterSignal: 30,
        thresholds,
      }),
    ).toBe("FLAT");
  });

  it("classifies SELL WIN when price fell (positive result30d)", () => {
    expect(
      classifyOutcome({
        signalType: "SELL",
        result30dPct: 5,
        result7dPct: 2,
        status: "CLOSED",
        barsAfterSignal: 30,
        thresholds,
      }),
    ).toBe("WIN");
  });

  it("returns INSUFFICIENT_DATA when bars too few", () => {
    expect(
      classifyOutcome({
        signalType: "BUY",
        result30dPct: null,
        result7dPct: null,
        status: "OPEN",
        barsAfterSignal: 5,
        thresholds,
      }),
    ).toBe("INSUFFICIENT_DATA");
  });

  it("returns EXPIRED outcome when status expired without 30d", () => {
    expect(
      classifyOutcome({
        signalType: "BUY",
        result30dPct: null,
        result7dPct: null,
        status: "EXPIRED",
        barsAfterSignal: 90,
        thresholds,
      }),
    ).toBe("EXPIRED");
  });

  it("returns PENDING when enough bars but no 30d yet", () => {
    expect(
      classifyOutcome({
        signalType: "BUY",
        result30dPct: null,
        result7dPct: 1,
        status: "OPEN",
        barsAfterSignal: 30,
        thresholds,
      }),
    ).toBe("PENDING");
  });
});
