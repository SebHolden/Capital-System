import { PrismaClient, TradeJournal, UserSettings, type RiskLevel } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { scoreJournal, toJournalInput } from "@/lib/journal";
import { CsrfError, verifyCsrfRequest } from "./csrf";
import { OriginError, verifyRequestOrigin } from "./origin";

export type DbClient = PrismaClient | Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$extends"
>;

const SETTINGS_ID = "default";

let executionModeEnvSynced = false;

function parseExecutionModeFromEnv(): "MOCK" | "PAPER" | "LIVE" | null {
  const raw = process.env.EXECUTION_MODE?.trim().toLowerCase();
  if (!raw) return null;
  if (raw === "mock") return "MOCK";
  if (raw === "paper") return "PAPER";
  if (raw === "live") return "LIVE";
  return null;
}

async function syncExecutionModeFromEnv(
  settings: UserSettings,
  client: PrismaClient,
): Promise<UserSettings> {
  if (executionModeEnvSynced) return settings;

  const envMode = parseExecutionModeFromEnv();
  executionModeEnvSynced = true;

  if (!envMode) return settings;

  if (settings.executionMode === envMode) return settings;

  const updated = await client.userSettings.update({
    where: { id: SETTINGS_ID },
    data: { executionMode: envMode },
  });

  await writeAuditLog(
    "EXECUTION_MODE_ENV_SYNC",
    "UserSettings",
    {
      previousMode: settings.executionMode,
      envMode,
      message:
        "EXECUTION_MODE da .env applicato al database (fonte di verità runtime: DB).",
    },
    SETTINGS_ID,
    client,
  );

  return updated;
}

function parseEnvFloat(key: string, fallback: number): number {
  const raw = process.env[key]?.trim();
  if (!raw) return fallback;
  const value = Number.parseFloat(raw);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function defaultLiveLimits() {
  return {
    maxLiveOrderAmount: parseEnvFloat("LIVE_DEFAULT_MAX_ORDER_AMOUNT", 500),
    maxDailyLiveAmount: parseEnvFloat("LIVE_DEFAULT_MAX_DAILY_AMOUNT", 2000),
    maxMonthlyLiveAmount: parseEnvFloat("LIVE_DEFAULT_MAX_MONTHLY_AMOUNT", 10000),
  };
}

const SERVER_ONLY_ENV_KEYS = [
  "ENABLE_LIVE_TRADING",
  "BROKER_API_KEY",
  "BROKER_API_SECRET",
  "ALPACA_API_KEY",
  "ALPACA_API_SECRET",
  "ALPACA_PAPER_BASE_URL",
  "ALPACA_LIVE_BASE_URL",
  "FINNHUB_API_KEY",
  "LIVE_TRADING_PASSPHRASE",
] as const;

/**
 * Guard for server-only secrets. Call from API routes / server actions
 * if a value might have been passed from client input.
 */
export function assertNotClientSecret(
  value: string | undefined,
  label: string,
): void {
  if (!value) return;

  for (const key of SERVER_ONLY_ENV_KEYS) {
    const envValue = process.env[key];
    if (envValue && value === envValue) {
      throw new Error(
        `${label} must not contain server secret values (${key}).`,
      );
    }
  }
}

export function isLiveTradingEnabled(): boolean {
  return process.env.ENABLE_LIVE_TRADING === "true";
}

export function checkKillSwitch(settings: UserSettings): {
  blocked: boolean;
  reason?: string;
} {
  if (settings.killSwitchActive) {
    return {
      blocked: true,
      reason: "Kill switch attivo: tutte le operazioni sono bloccate.",
    };
  }
  return { blocked: false };
}

export function validateJournalForOrder(journal: TradeJournal | null): {
  valid: boolean;
  level: RiskLevel;
  qualityScore: number;
  reasons: string[];
  warnings: string[];
} {
  if (!journal) {
    return {
      valid: false,
      level: "RED",
      qualityScore: 0,
      reasons: ["Journal decisionale assente."],
      warnings: [],
    };
  }

  const scored = scoreJournal(toJournalInput(journal));

  const reasons = [...scored.reasons];
  const warnings = [...scored.warnings];

  if (!journal.isComplete || !scored.isComplete) {
    const incompleteMessage =
      "Journal incompleto: completa tutti i campi obbligatori.";
    if (!reasons.includes(incompleteMessage)) {
      reasons.push(incompleteMessage);
    }
  }

  const valid =
    scored.isComplete && journal.isComplete && scored.level !== "RED";

  return {
    valid,
    level: scored.level,
    qualityScore: scored.qualityScore,
    reasons: [...new Set(reasons)],
    warnings,
  };
}

export async function writeAuditLog(
  action: string,
  entity: string,
  payload: Record<string, unknown>,
  entityId?: string,
  client: DbClient = prisma,
): Promise<void> {
  await client.auditLog.create({
    data: {
      action,
      entity,
      entityId,
      payload: JSON.stringify(payload),
    },
  });
}

export async function listAuditLog({
  since,
  until,
  action,
  entity,
  client = prisma,
}: {
  since: Date;
  until: Date;
  action?: string;
  entity?: string;
  client?: PrismaClient;
}) {
  return client.auditLog.findMany({
    where: {
      createdAt: { gte: since, lte: until },
      ...(action ? { action } : {}),
      ...(entity ? { entity } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
}

export async function getUserSettings(client: PrismaClient = prisma) {
  let settings = await client.userSettings.findUnique({
    where: { id: SETTINGS_ID },
  });

  if (!settings) {
    settings = await client.userSettings.create({
      data: {
        id: SETTINGS_ID,
        ...defaultLiveLimits(),
      },
    });
  }

  return syncExecutionModeFromEnv(settings, client);
}

export { SETTINGS_ID };

export {
  verifyLivePassphrase,
  isLivePassphraseConfigured,
  hasPromotedStrategy,
  getDailyLiveVolume,
  getMonthlyLiveVolume,
  checkLiveOrderLimits,
  getBrokerPermissionsChecklist,
  type BrokerPermissionsChecklist,
  type ChecklistItem,
  type LiveVolumeSnapshot,
} from "./live";

export {
  CsrfError,
  verifyCsrfRequest,
  CSRF_COOKIE_NAME,
  CSRF_HEADER_NAME,
} from "./csrf";

export { OriginError, verifyRequestOrigin } from "./origin";

export function verifyMutatingRequest(request: Request): void {
  verifyCsrfRequest(request);
  verifyRequestOrigin(request);
}

export function mapMutatingSecurityError(error: unknown): NextResponse | null {
  if (error instanceof CsrfError) {
    return NextResponse.json(
      { error: error.message, code: "CSRF_INVALID" },
      { status: 403 },
    );
  }
  if (error instanceof OriginError) {
    return NextResponse.json(
      { error: error.message, code: "ORIGIN_INVALID" },
      { status: 403 },
    );
  }
  return null;
}
