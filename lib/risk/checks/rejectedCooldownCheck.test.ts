import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    orderIntent: {
      findFirst: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/db";
import { evaluateRejectedCooldownCheck } from "./rejectedCooldownCheck";

describe("evaluateRejectedCooldownCheck", () => {
  beforeEach(() => {
    vi.mocked(prisma.orderIntent.findFirst).mockReset();
  });

  it("skips check when cooldown is zero", async () => {
    const result = await evaluateRejectedCooldownCheck(0);
    expect(result.block).toBe(false);
    expect(prisma.orderIntent.findFirst).not.toHaveBeenCalled();
  });

  it("blocks when recent rejected order exists", async () => {
    vi.mocked(prisma.orderIntent.findFirst).mockResolvedValue({
      id: "intent-1",
      status: "REJECTED",
      createdAt: new Date(),
    } as never);

    const result = await evaluateRejectedCooldownCheck(15);
    expect(result.block).toBe(true);
    expect(result.reasons[0]).toContain("Cooldown");
  });

  it("allows when no recent rejected order", async () => {
    vi.mocked(prisma.orderIntent.findFirst).mockResolvedValue(null);

    const result = await evaluateRejectedCooldownCheck(15);
    expect(result.block).toBe(false);
  });
});
