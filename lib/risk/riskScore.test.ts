import { describe, expect, it } from "vitest";
import { computeRiskScore, riskScoreLabel } from "./riskScore";

describe("computeRiskScore", () => {
  it("returns low score for healthy GREEN portfolio", () => {
    const score = computeRiskScore({
      riskLevel: "GREEN",
      drawdownPct: 2,
      maxDrawdownPct: 20,
      maxPositionPct: 25,
      topPositionPct: 10,
      journalQualityAvg: 85,
    });
    expect(score).toBeLessThanOrEqual(15);
    expect(riskScoreLabel(score)).toBe("Basso");
  });

  it("returns high score for BLACK with concentration and drawdown", () => {
    const score = computeRiskScore({
      riskLevel: "BLACK",
      drawdownPct: 18,
      maxDrawdownPct: 20,
      maxPositionPct: 25,
      topPositionPct: 30,
      journalQualityAvg: 40,
    });
    expect(score).toBeGreaterThanOrEqual(90);
    expect(riskScoreLabel(score)).toBe("Critico");
  });

  it("clamps score between 0 and 100", () => {
    const low = computeRiskScore({
      riskLevel: "GREEN",
      drawdownPct: 0,
      maxDrawdownPct: 20,
      maxPositionPct: 25,
      topPositionPct: 0,
      journalQualityAvg: 100,
    });
    expect(low).toBeGreaterThanOrEqual(0);
    expect(low).toBeLessThanOrEqual(100);
  });

  it("penalizes untrusted price exposure", () => {
    const baseline = computeRiskScore({
      riskLevel: "GREEN",
      drawdownPct: 2,
      maxDrawdownPct: 20,
      maxPositionPct: 25,
      topPositionPct: 10,
      journalQualityAvg: 85,
    });

    const withUntrusted = computeRiskScore({
      riskLevel: "GREEN",
      drawdownPct: 2,
      maxDrawdownPct: 20,
      maxPositionPct: 25,
      topPositionPct: 10,
      journalQualityAvg: 85,
      hasUntrustedPrices: true,
      untrustedPricePct: 10,
    });

    expect(withUntrusted).toBeGreaterThan(baseline);
  });

  it("forces score to at least 80 when untrusted exposure is >= 25%", () => {
    const score = computeRiskScore({
      riskLevel: "GREEN",
      drawdownPct: 0,
      maxDrawdownPct: 20,
      maxPositionPct: 25,
      topPositionPct: 5,
      journalQualityAvg: 90,
      hasUntrustedPrices: true,
      untrustedPricePct: 25,
    });
    expect(score).toBeGreaterThanOrEqual(80);
    expect(riskScoreLabel(score)).toBe("Critico");
  });
});
