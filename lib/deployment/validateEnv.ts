import { isAlpacaConfigured } from "@/lib/brokers";
import { logError, logWarn } from "@/lib/logger";
import { isLivePassphraseConfigured } from "@/lib/security/live";

export type EnvValidationResult = {
  errors: string[];
  warnings: string[];
};

export type ExecutionModeName = "mock" | "paper" | "live";

function isProduction(env: NodeJS.ProcessEnv): boolean {
  return env.NODE_ENV === "production";
}

function isLiveTradingEnabled(env: NodeJS.ProcessEnv): boolean {
  return env.ENABLE_LIVE_TRADING === "true";
}

function parseExecutionMode(
  raw: string | undefined,
): ExecutionModeName | null {
  const normalized = raw?.trim().toLowerCase();
  if (!normalized) return null;
  if (normalized === "mock") return "mock";
  if (normalized === "paper") return "paper";
  if (normalized === "live") return "live";
  return null;
}

export function getEffectiveExecutionMode(
  env: NodeJS.ProcessEnv = process.env,
): ExecutionModeName {
  return parseExecutionMode(env.EXECUTION_MODE) ?? "mock";
}

function validateLiveTradingPrerequisites(): string[] {
  const missing: string[] = [];

  if (!isLivePassphraseConfigured()) {
    missing.push("LIVE_TRADING_PASSPHRASE");
  }
  if (!isAlpacaConfigured()) {
    missing.push("ALPACA_API_KEY and ALPACA_API_SECRET");
  }

  if (missing.length > 0) {
    return [
      `ENABLE_LIVE_TRADING=true requires: ${missing.join(", ")}.`,
    ];
  }

  return [];
}

export function validateProductionEnv(
  env: NodeJS.ProcessEnv = process.env,
): EnvValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!isProduction(env)) {
    return { errors, warnings };
  }

  if (!env.APP_PASSWORD?.trim()) {
    warnings.push(
      "APP_PASSWORD is not set; the app is publicly accessible without Basic auth.",
    );
  }

  if (!env.APP_BASE_URL?.trim()) {
    errors.push("APP_BASE_URL is required in production.");
  }

  if (!env.DATABASE_URL?.trim()) {
    errors.push("DATABASE_URL is required.");
  } else if (env.DATABASE_URL.trim().startsWith("file:")) {
    warnings.push(
      "SQLite (file: DATABASE_URL) is not recommended for stable online deployment. Prefer PostgreSQL.",
    );
  }

  const executionMode = parseExecutionMode(env.EXECUTION_MODE);
  if (env.EXECUTION_MODE?.trim() && !executionMode) {
    warnings.push(
      `Invalid EXECUTION_MODE "${env.EXECUTION_MODE}"; effective default is mock.`,
    );
  }

  if (isLiveTradingEnabled(env)) {
    errors.push(...validateLiveTradingPrerequisites());
  }

  return { errors, warnings };
}

export function assertProductionEnvOrExit(
  env: NodeJS.ProcessEnv = process.env,
): EnvValidationResult {
  const result = validateProductionEnv(env);

  for (const warning of result.warnings) {
    logWarn(`[env] ${warning}`);
  }

  if (!isProduction(env)) {
    return result;
  }

  if (result.errors.length > 0) {
    for (const error of result.errors) {
      logError(`[env] ${error}`);
    }
    process.exit(1);
  }

  return result;
}
