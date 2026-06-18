import { describe, expect, it, afterEach } from "vitest";
import { middleware } from "./middleware";

function makeRequest(authHeader?: string): Parameters<typeof middleware>[0] {
  const headers = new Headers();
  if (authHeader) {
    headers.set("authorization", authHeader);
  }
  return {
    headers: {
      get: (name: string) => headers.get(name),
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

  it("blocks all requests in production when APP_PASSWORD is missing", () => {
    process.env.NODE_ENV = "production";
    delete process.env.APP_PASSWORD;

    const response = middleware(makeRequest());
    expect(response.status).toBe(500);
  });

  it("allows requests in development when APP_PASSWORD is missing", () => {
    process.env.NODE_ENV = "development";
    delete process.env.APP_PASSWORD;

    const response = middleware(makeRequest());
    expect(response.status).toBe(200);
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
});
