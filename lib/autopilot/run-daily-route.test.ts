import { describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/autopilot/run-daily/route";
import { CsrfError } from "@/lib/security/csrf";

vi.mock("@/lib/autopilot", () => ({
  runDailyWorkflow: vi.fn().mockResolvedValue({
    brief: {
      date: "2026-06-18",
      safetyNotice: { liveTradingDisabled: true, messages: [] },
    },
    workflow: { prices: { refreshed: 1, failed: 0 }, paperSignals: {} },
  }),
}));

vi.mock("@/lib/security", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/security")>();
  return {
    ...actual,
    verifyMutatingRequest: vi.fn(),
  };
});

import { verifyMutatingRequest } from "@/lib/security";

describe("POST /api/autopilot/run-daily", () => {
  it("requires mutating request verification", async () => {
    vi.mocked(verifyMutatingRequest).mockImplementation(() => {
      throw new CsrfError();
    });

    const response = await POST(new Request("http://localhost/api/autopilot/run-daily", {
      method: "POST",
    }));
    const body = await response.json();

    expect(verifyMutatingRequest).toHaveBeenCalled();
    expect(response.status).toBe(403);
    expect(body.code).toBe("CSRF_INVALID");
  });

  it("returns brief when verification passes", async () => {
    vi.mocked(verifyMutatingRequest).mockImplementation(() => undefined);

    const response = await POST(new Request("http://localhost/api/autopilot/run-daily", {
      method: "POST",
    }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.brief).toBeDefined();
    expect(body.message).toContain("Nessuna esecuzione live");
  });
});
