import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/health/route";

vi.mock("@/lib/db", () => ({
  prisma: {
    $queryRaw: vi.fn(),
    userSettings: {
      findUnique: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/db";

describe("GET /api/health", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.clearAllMocks();
  });

  it("returns expected public fields without secrets", async () => {
    process.env.APP_PASSWORD = "super-secret-password";
    process.env.DATABASE_URL = "postgresql://user:pass@localhost:5432/seb";
    process.env.ALPACA_API_KEY = "alpaca-key-secret";
    process.env.ALPACA_API_SECRET = "alpaca-secret-value";
    process.env.LIVE_TRADING_PASSPHRASE = "live-passphrase-secret";
    process.env.ENABLE_LIVE_TRADING = "false";
    process.env.EXECUTION_MODE = "mock";

    vi.mocked(prisma.$queryRaw).mockResolvedValue([{ 1: 1 }]);
    vi.mocked(prisma.userSettings.findUnique).mockResolvedValue({
      executionMode: "MOCK",
    } as never);

    const response = await GET();
    const body = await response.json();
    const serialized = JSON.stringify(body);

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      ok: true,
      version: expect.any(String),
      executionMode: "mock",
      liveTradingEnabled: false,
      databaseReachable: true,
      timestamp: expect.any(String),
    });

    expect(serialized).not.toContain("super-secret-password");
    expect(serialized).not.toContain("postgresql://user:pass");
    expect(serialized).not.toContain("alpaca-key-secret");
    expect(serialized).not.toContain("alpaca-secret-value");
    expect(serialized).not.toContain("live-passphrase-secret");
    expect(serialized).not.toContain("livePassphrase");
  });

  it("reports databaseReachable false when DB ping fails", async () => {
    process.env.ENABLE_LIVE_TRADING = "false";
    vi.mocked(prisma.$queryRaw).mockRejectedValue(new Error("db down"));

    const response = await GET();
    const body = await response.json();

    expect(body.ok).toBe(false);
    expect(body.databaseReachable).toBe(false);
  });
});
