import { describe, expect, it } from "vitest";
import { correlationMatrix, pearsonCorrelation } from "./correlation";

describe("pearsonCorrelation", () => {
  it("returns 1 for identical series", () => {
    const s = [0.01, 0.02, -0.01, 0.005];
    expect(pearsonCorrelation(s, s)).toBeCloseTo(1);
  });

  it("builds symmetric matrix", () => {
    const matrix = correlationMatrix({
      A: [0.01, 0.02, 0.03],
      B: [0.02, 0.04, 0.06],
    });
    expect(matrix.A.B).toBeCloseTo(1);
    expect(matrix.B.A).toBeCloseTo(1);
  });
});
