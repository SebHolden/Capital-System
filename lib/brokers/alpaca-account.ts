import type { ExecutionMode } from "@prisma/client";
import { prisma } from "@/lib/db";
import { isAlpacaConfigured } from "./alpaca-broker";

const DEFAULT_PAPER_BASE_URL = "https://paper-api.alpaca.markets";
const DEFAULT_LIVE_BASE_URL = "https://api.alpaca.markets";

function getAlpacaBaseUrl(mode: ExecutionMode): string {
  if (mode === "LIVE") {
    return (
      process.env.ALPACA_LIVE_BASE_URL?.trim() || DEFAULT_LIVE_BASE_URL
    ).replace(/\/$/, "");
  }
  return (
    process.env.ALPACA_PAPER_BASE_URL?.trim() || DEFAULT_PAPER_BASE_URL
  ).replace(/\/$/, "");
}

export interface AlpacaAccountData {
  id: string;
  equity: string | number;
  cash: string | number;
  buying_power: string | number;
  currency: string;
  status: string;
  trading_blocked: boolean;
  account_blocked: boolean;
}

export async function fetchAlpacaAccount(
  mode: "PAPER" | "LIVE",
): Promise<AlpacaAccountData> {
  if (!isAlpacaConfigured()) {
    throw new Error("Alpaca non configurato.");
  }

  const baseUrl = getAlpacaBaseUrl(mode);
  const response = await fetch(`${baseUrl}/v2/account`, {
    headers: {
      "APCA-API-KEY-ID": process.env.ALPACA_API_KEY!.trim(),
      "APCA-API-SECRET-KEY": process.env.ALPACA_API_SECRET!.trim(),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Alpaca account error ${response.status}: ${text}`);
  }

  return response.json() as Promise<AlpacaAccountData>;
}

export async function syncBrokerAccountSnapshot(
  mode: "PAPER" | "LIVE" = "PAPER",
) {
  const account = await fetchAlpacaAccount(mode);
  const brokerName = mode === "LIVE" ? "alpaca-live" : "alpaca-paper";

  const snapshot = await prisma.brokerAccountSnapshot.create({
    data: {
      brokerName,
      mode,
      accountId: account.id,
      equity: Number.parseFloat(String(account.equity)) || 0,
      cash: Number.parseFloat(String(account.cash)) || 0,
      buyingPower: Number.parseFloat(String(account.buying_power)) || null,
      currency: account.currency || "USD",
      payloadJson: JSON.stringify({
        status: account.status,
        tradingBlocked: account.trading_blocked,
        accountBlocked: account.account_blocked,
      }),
    },
  });

  return snapshot;
}

export async function getLatestBrokerSnapshot(mode?: ExecutionMode) {
  return prisma.brokerAccountSnapshot.findFirst({
    where: mode ? { mode } : undefined,
    orderBy: { capturedAt: "desc" },
  });
}
