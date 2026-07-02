import { describe, expect, it, afterEach } from "vitest";
import { middleware } from "./middleware";

function makeRequest(
  authHeader?: string,
  pathname = "/",
): Parameters<typeof middleware>[0] {
  const headers = new Headers();
  if (authHeader) {
    headers.set("authorization", authHeader);
  }
  return {
    headers: {
      get: (name: string) => headers.get(name),
    },
    nextUrl: {
      pathname,
    },
  } as Parameters<typeof middleware>[0];
}

function basicAuth(password: string): string {
  return `Basic ${Buffer.from(`user:${password}`).toString("base64")}`;
}

describe("middleware auth", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("returns 503 in production when APP_PASSWORD is missing", () => {
    process.env.NODE_ENV = "production";
    delete process.env.APP_PASSWORD;
    delete process.env.APP_AUTH_DISABLED;

    const response = middleware(makeRequest());
    expect(response.status).toBe(503);
  });

  it("returns 503 in development when APP_PASSWORD is missing and auth not disabled", () => {
    process.env.NODE_ENV = "development";
    delete process.env.APP_PASSWORD;
    delete process.env.APP_AUTH_DISABLED;

    const response = middleware(makeRequest());
    expect(response.status).toBe(503);
  });

  it("allows local bypass only when APP_AUTH_DISABLED=true and not production", () => {
    process.env.NODE_ENV = "development";
    delete process.env.APP_PASSWORD;
    process.env.APP_AUTH_DISABLED = "true";

    const response = middleware(makeRequest());
    expect(response.status).toBe(200);
  });

  it("does not allow APP_AUTH_DISABLED bypass in production", () => {
    process.env.NODE_ENV = "production";
    delete process.env.APP_PASSWORD;
    process.env.APP_AUTH_DISABLED = "true";

    const response = middleware(makeRequest());
    expect(response.status).toBe(503);
  });

  it("returns 401 for invalid password", () => {
    process.env.NODE_ENV = "development";
    process.env.APP_PASSWORD = "secret";

    const response = middleware(makeRequest(basicAuth("wrong")));
    expect(response.status).toBe(401);
  });

  it("allows valid password", () => {
    process.env.NODE_ENV = "development";
    process.env.APP_PASSWORD = "secret";

    const response = middleware(makeRequest(basicAuth("secret")));
    expect(response.status).toBe(200);
  });

  it("bypasses auth for /api/health", () => {
    process.env.NODE_ENV = "production";
    delete process.env.APP_PASSWORD;

    const response = middleware(makeRequest(undefined, "/api/health"));
    expect(response.status).toBe(200);
  });
});
