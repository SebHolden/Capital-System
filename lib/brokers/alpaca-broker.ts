import type { ExecutionMode } from "@prisma/client";
import { BaseBrokerAdapter, type ExecutionResult, type OrderIntentInput } from "./types";

const DEFAULT_PAPER_BASE_URL = "https://paper-api.alpaca.markets";
const DEFAULT_LIVE_BASE_URL = "https://api.alpaca.markets";

export function isAlpacaConfigured(): boolean {
  return Boolean(
    process.env.ALPACA_API_KEY?.trim() &&
      process.env.ALPACA_API_SECRET?.trim(),
  );
}

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

export function isAlpacaCompatibleSymbol(
  symbol: string,
  assetType?: string,
): boolean {
  if (assetType !== "STOCK" && assetType !== "ETF") {
    return false;
  }

  if (!/^[A-Z]{1,5}$/.test(symbol)) {
    return false;
  }

  const euDenylist = new Set(["SWDA", "EIMI", "SGLD", "VWCE", "CSPX"]);
  return !euDenylist.has(symbol);
}

async function placeAlpacaOrder(
  intent: OrderIntentInput,
  mode: ExecutionMode,
  brokerName: string,
  label: string,
): Promise<ExecutionResult> {
  if (!isAlpacaConfigured()) {
    return {
      success: false,
      fillPrice: null,
      message: "Alpaca non configurato: imposta ALPACA_API_KEY e ALPACA_API_SECRET.",
      brokerName,
    };
  }

  if (intent.quantity <= 0 || intent.limitPrice <= 0) {
    return {
      success: false,
      fillPrice: null,
      message: "Quantità e prezzo limite devono essere maggiori di zero.",
      brokerName,
    };
  }

  const baseUrl = getAlpacaBaseUrl(mode);
  const side = intent.side === "BUY" ? "buy" : "sell";

  try {
    const response = await fetch(`${baseUrl}/v2/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "APCA-API-KEY-ID": process.env.ALPACA_API_KEY!.trim(),
        "APCA-API-SECRET-KEY": process.env.ALPACA_API_SECRET!.trim(),
      },
      body: JSON.stringify({
        symbol: intent.symbol,
        qty: String(intent.quantity),
        side,
        type: "limit",
        limit_price: String(intent.limitPrice),
        time_in_force: "day",
      }),
    });

    const payload = (await response.json()) as {
      id?: string;
      status?: string;
      filled_avg_price?: string | null;
      limit_price?: string;
      message?: string;
    };

    if (!response.ok) {
      const detail =
        payload.message ??
        `Alpaca HTTP ${response.status}: ordine rifiutato per ${intent.symbol}.`;
      return {
        success: false,
        fillPrice: null,
        message: detail,
        brokerName,
      };
    }

    const fillPrice = payload.filled_avg_price
      ? parseFloat(payload.filled_avg_price)
      : payload.limit_price
        ? parseFloat(payload.limit_price)
        : intent.limitPrice;

    return {
      success: true,
      fillPrice,
      brokerOrderId: payload.id,
      brokerName,
      message: `Alpaca ${label}: ${intent.side} ${intent.quantity} ${intent.symbol} @ $${fillPrice.toFixed(2)} (status ${payload.status ?? "submitted"})`,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : `Errore di rete verso Alpaca ${label}.`;
    return {
      success: false,
      fillPrice: null,
      message: `Alpaca ${label} fallito: ${message}`,
      brokerName,
    };
  }
}

export class AlpacaBroker extends BaseBrokerAdapter {
  name = "alpaca-paper";
  mode = "PAPER" as const;

  async placeOrder(intent: OrderIntentInput): Promise<ExecutionResult> {
    return placeAlpacaOrder(intent, "PAPER", this.name, "paper");
  }
}

export class AlpacaLiveBroker extends BaseBrokerAdapter {
  name = "alpaca-live";
  mode = "LIVE" as const;

  async placeOrder(intent: OrderIntentInput): Promise<ExecutionResult> {
    return placeAlpacaOrder(intent, "LIVE", this.name, "live");
  }
}
