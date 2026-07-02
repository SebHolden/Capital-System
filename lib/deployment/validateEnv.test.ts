import { afterEach, describe, expect, it } from "vitest";
import {
  getEffectiveExecutionMode,
  validateProductionEnv,
} from "./validateEnv";

describe("validateProductionEnv", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("does not error in development when production vars are missing", () => {
    process.env.NODE_ENV = "development";
    delete process.env.APP_PASSWORD;
    delete process.env.APP_BASE_URL;
    delete process.env.DATABASE_URL;

    const result = validateProductionEnv(process.env);
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
  });

  it("errors in production without APP_PASSWORD", () => {
    process.env.NODE_ENV = "production";
    delete process.env.APP_PASSWORD;
    process.env.APP_BASE_URL = "https://staging.example.com";
    process.env.DATABASE_URL = "file:./prod.db";
    process.env.ENABLE_LIVE_TRADING = "false";

    const result = validateProductionEnv(process.env);
    expect(result.errors.some((e) => e.includes("APP_PASSWORD"))).toBe(true);
  });

  it("errors in production when APP_AUTH_DISABLED is true", () => {
    process.env.NODE_ENV = "production";
    process.env.APP_PASSWORD = "strong-password";
    process.env.APP_AUTH_DISABLED = "true";
    process.env.APP_BASE_URL = "https://staging.example.com";
    process.env.DATABASE_URL = "file:./prod.db";
    process.env.ENABLE_LIVE_TRADING = "false";

    const result = validateProductionEnv(process.env);
    expect(result.errors.some((e) => e.includes("APP_AUTH_DISABLED"))).toBe(true);
  });

  it("fails in production without APP_BASE_URL", () => {
    process.env.NODE_ENV = "production";
    process.env.APP_PASSWORD = "strong-password";
    delete process.env.APP_BASE_URL;
    process.env.DATABASE_URL = "file:./prod.db";
    process.env.ENABLE_LIVE_TRADING = "false";

    const result = validateProductionEnv(process.env);
    expect(result.errors).toContain("APP_BASE_URL is required in production.");
  });

  it("passes in production with ENABLE_LIVE_TRADING=false", () => {
    process.env.NODE_ENV = "production";
    process.env.APP_PASSWORD = "strong-password";
    process.env.APP_BASE_URL = "https://staging.example.com";
    process.env.DATABASE_URL = "file:./prod.db";
    process.env.ENABLE_LIVE_TRADING = "false";
    process.env.EXECUTION_MODE = "mock";

    const result = validateProductionEnv(process.env);
    expect(result.errors).toEqual([]);
  });

  it("warns when SQLite is used in production", () => {
    process.env.NODE_ENV = "production";
    process.env.APP_PASSWORD = "strong-password";
    process.env.APP_BASE_URL = "https://staging.example.com";
    process.env.DATABASE_URL = "file:./prod.db";
    process.env.ENABLE_LIVE_TRADING = "false";

    const result = validateProductionEnv(process.env);
    expect(result.warnings.some((w) => w.includes("SQLite"))).toBe(true);
  });

  it("defaults execution mode to mock when missing", () => {
    delete process.env.EXECUTION_MODE;
    expect(getEffectiveExecutionMode(process.env)).toBe("mock");
  });
});
