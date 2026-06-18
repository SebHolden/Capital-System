import { isLiveTradingEnabled } from "@/lib/security";
import {
  AlpacaLiveBroker,
  isAlpacaCompatibleSymbol,
  isAlpacaConfigured,
} from "./alpaca-broker";
import { BaseBrokerAdapter, type ExecutionResult, type OrderIntentInput } from "./types";

export class LiveBroker extends BaseBrokerAdapter {
  name = "live";
  mode = "LIVE" as const;
  private alpacaLive = new AlpacaLiveBroker();

  async placeOrder(intent: OrderIntentInput): Promise<ExecutionResult> {
    if (!isLiveTradingEnabled()) {
      return {
        success: false,
        fillPrice: null,
        brokerName: this.name,
        message: `Live trading disabilitato per ${intent.symbol}: ENABLE_LIVE_TRADING non è true.`,
      };
    }

    if (
      isAlpacaConfigured() &&
      isAlpacaCompatibleSymbol(intent.symbol, intent.assetType)
    ) {
      return this.alpacaLive.placeOrder(intent);
    }

    return {
      success: false,
      fillPrice: null,
      brokerName: this.name,
      message: `Live non disponibile per ${intent.symbol}: richiede simbolo USA compatibile Alpaca e chiavi API configurate.`,
    };
  }
}
