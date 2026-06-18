import { timingSafeEqual } from "crypto";
import type { UserSettings } from "@prisma/client";
import { prisma } from "@/lib/db";
import { isAlpacaConfigured } from "@/lib/brokers";
import { computeRiskMetrics } from "@/lib/risk/baselines";

function isLiveTradingEnabledEnv(): boolean {
  return process.env.ENABLE_LIVE_TRADING === "true";
}

function startOfMonth(now = new Date()): Date {
  return new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
}

export interface ChecklistItem {
  id: string;
  label: string;
  passed: boolean;
  required: boolean;
  detail?: string;
}

export interface LiveVolumeSnapshot {
  dailyUsed: number;
  dailyLimit: number;
  monthlyUsed: number;
  monthlyLimit: number;
}

export interface BrokerPermissionsChecklist {
  ready: boolean;
  items: ChecklistItem[];
  liveVolumes?: LiveVolumeSnapshot;
}

export function isLivePassphraseConfigured(): boolean {
  return Boolean(process.env.LIVE_TRADING_PASSPHRASE?.trim());
}

export function verifyLivePassphrase(input: string | undefined): boolean {
  const expected = process.env.LIVE_TRADING_PASSPHRASE?.trim();
  if (!expected || !input) return false;

  const inputBuf = Buffer.from(input);
  const expectedBuf = Buffer.from(expected);
  if (inputBuf.length !== expectedBuf.length) return false;

  return timingSafeEqual(inputBuf, expectedBuf);
}

export async function hasPromotedStrategy(): Promise<boolean> {
  const count = await prisma.strategy.count({
    where: { status: "PROMOTED" },
  });
  return count > 0;
}

async function sumLiveVolumeSince(since: Date): Promise<number> {
  const logs = await prisma.executionLog.findMany({
    where: {
      mode: "LIVE",
      status: "FILLED",
      createdAt: { gte: since },
    },
    include: {
      orderIntent: { select: { quantity: true } },
    },
  });

  return logs.reduce((sum, log) => {
    const qty = log.orderIntent.quantity;
    const price = log.fillPrice ?? 0;
    return sum + qty * price;
  }, 0);
}

export async function getDailyLiveVolume(): Promise<number> {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  return sumLiveVolumeSince(startOfDay);
}

export async function getMonthlyLiveVolume(): Promise<number> {
  return sumLiveVolumeSince(startOfMonth());
}

export function checkLiveOrderLimits(
  settings: UserSettings,
  orderAmount: number,
  dailyLiveVolume: number,
  monthlyLiveVolume: number,
): { allowed: boolean; reason?: string } {
  if (orderAmount > settings.maxLiveOrderAmount) {
    return {
      allowed: false,
      reason: `Importo ordine LIVE €${orderAmount.toFixed(2)} supera il massimo €${settings.maxLiveOrderAmount.toFixed(2)}.`,
    };
  }

  if (dailyLiveVolume + orderAmount > settings.maxDailyLiveAmount) {
    return {
      allowed: false,
      reason: `Volume LIVE giornaliero supererebbe il limite €${settings.maxDailyLiveAmount.toFixed(2)} (attuale €${dailyLiveVolume.toFixed(2)}).`,
    };
  }

  if (monthlyLiveVolume + orderAmount > settings.maxMonthlyLiveAmount) {
    return {
      allowed: false,
      reason: `Volume LIVE mensile supererebbe il limite €${settings.maxMonthlyLiveAmount.toFixed(2)} (attuale €${monthlyLiveVolume.toFixed(2)}).`,
    };
  }

  return { allowed: true };
}

export async function getBrokerPermissionsChecklist(
  settings?: UserSettings,
  portfolioTotalValue?: number,
): Promise<BrokerPermissionsChecklist> {
  const userSettings =
    settings ??
    (await prisma.userSettings.findUnique({ where: { id: "default" } }));

  const [promoted, dailyUsed, monthlyUsed] = await Promise.all([
    hasPromotedStrategy(),
    getDailyLiveVolume(),
    getMonthlyLiveVolume(),
  ]);

  const dailyLimit = userSettings?.maxDailyLiveAmount ?? 2000;
  const monthlyLimit = userSettings?.maxMonthlyLiveAmount ?? 10000;

  const items: ChecklistItem[] = [
    {
      id: "live_env",
      label: "ENABLE_LIVE_TRADING=true",
      passed: isLiveTradingEnabledEnv(),
      required: true,
    },
    {
      id: "passphrase_configured",
      label: "LIVE_TRADING_PASSPHRASE configurata",
      passed: isLivePassphraseConfigured(),
      required: true,
    },
    {
      id: "alpaca_keys",
      label: "ALPACA_API_KEY e ALPACA_API_SECRET",
      passed: isAlpacaConfigured(),
      required: true,
    },
    {
      id: "kill_switch_off",
      label: "Kill switch disattivo",
      passed: !userSettings?.killSwitchActive,
      required: true,
      detail: userSettings?.killSwitchActive
        ? "Kill switch attivo — disattivalo in Settings."
        : undefined,
    },
    {
      id: "promoted_strategy",
      label: "Almeno una strategia PROMOTED",
      passed: promoted,
      required: true,
      detail: promoted
        ? undefined
        : "Completa paper trading e promuovi una strategia in /strategies.",
    },
    {
      id: "monthly_live_within_limit",
      label: "Volume LIVE mensile entro limite",
      passed: monthlyUsed < monthlyLimit,
      required: true,
      detail: `Usato €${monthlyUsed.toFixed(2)} / €${monthlyLimit.toFixed(2)} questo mese.`,
    },
    {
      id: "eu_assets_warning",
      label: "Asset USA su Alpaca (ETF EU non supportati)",
      passed: true,
      required: false,
      detail:
        "Solo simboli USA compatibili Alpaca. ETF seed EU (SWDA, EIMI) non eseguibili in LIVE.",
    },
  ];

  if (userSettings && portfolioTotalValue !== undefined) {
    const metrics = computeRiskMetrics(userSettings, portfolioTotalValue);
    const monthlyLossWithinLimit =
      metrics.monthly.pnlPct >= -userSettings.maxMonthlyLossPct;
    items.push({
      id: "portfolio_monthly_loss",
      label: "Perdita mensile portafoglio entro limite",
      passed: monthlyLossWithinLimit,
      required: false,
      detail: `PnL mese: ${metrics.monthly.pnlPct.toFixed(1)}% (limite -${userSettings.maxMonthlyLossPct}%).`,
    });
  }

  const ready = items.filter((i) => i.required).every((i) => i.passed);

  return {
    ready,
    items,
    liveVolumes: userSettings
      ? {
          dailyUsed,
          dailyLimit,
          monthlyUsed,
          monthlyLimit,
        }
      : undefined,
  };
}
