import { describe, expect, it, afterEach, vi } from "vitest";
import { OriginError, verifyRequestOrigin } from "./origin";

function makeRequest(
  init: {
    origin?: string;
    referer?: string;
    host?: string;
  } = {},
): Request {
  const headers = new Headers();
  if (init.origin) headers.set("origin", init.origin);
  if (init.referer) headers.set("referer", init.referer);
  if (init.host) headers.set("host", init.host);
  return new Request("http://localhost/api/test", { headers });
}

describe("verifyRequestOrigin", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  it("uses Host fallback in production when APP_BASE_URL is unset", () => {
    delete process.env.APP_BASE_URL;
    process.env.NODE_ENV = "production";
    expect(() =>
      verifyRequestOrigin(
        makeRequest({
          origin: "https://app.example.com",
          host: "app.example.com",
        }),
      ),
    ).not.toThrow();
  });

  it("rejects missing Origin in production with Host fallback", () => {
    delete process.env.APP_BASE_URL;
    process.env.NODE_ENV = "production";
    expect(() =>
      verifyRequestOrigin(makeRequest({ host: "app.example.com" })),
    ).toThrow(OriginError);
  });

  it("rejects when neither APP_BASE_URL nor Host is available in production", () => {
    delete process.env.APP_BASE_URL;
    process.env.NODE_ENV = "production";
    expect(() => verifyRequestOrigin(makeRequest())).toThrow(OriginError);
  });

  it("rejects missing Origin in production when APP_BASE_URL is set", () => {
    process.env.APP_BASE_URL = "http://localhost:3000";
    process.env.NODE_ENV = "production";
    expect(() =>
      verifyRequestOrigin(makeRequest({ host: "localhost:3000" })),
    ).toThrow(OriginError);
  });

  it("rejects mismatched Origin in production", () => {
    process.env.APP_BASE_URL = "http://localhost:3000";
    process.env.NODE_ENV = "production";
    expect(() =>
      verifyRequestOrigin(
        makeRequest({
          origin: "https://evil.example",
          host: "localhost:3000",
        }),
      ),
    ).toThrow(OriginError);
  });

  it("accepts matching Origin and Host in production", () => {
    process.env.APP_BASE_URL = "http://localhost:3000";
    process.env.NODE_ENV = "production";
    expect(() =>
      verifyRequestOrigin(
        makeRequest({
          origin: "http://localhost:3000",
          host: "localhost:3000",
        }),
      ),
    ).not.toThrow();
  });

  it("allows missing Origin in development", () => {
    process.env.APP_BASE_URL = "http://localhost:3000";
    process.env.NODE_ENV = "development";
    expect(() => verifyRequestOrigin(makeRequest())).not.toThrow();
  });

  it("warns in development when Origin is missing but APP_BASE_URL is set", () => {
    process.env.APP_BASE_URL = "http://localhost:3000";
    process.env.NODE_ENV = "development";
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    verifyRequestOrigin(makeRequest({ host: "localhost:3000" }));
    expect(warnSpy).toHaveBeenCalled();
  });
});
