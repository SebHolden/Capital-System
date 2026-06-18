import { BaseBrokerAdapter, type ExecutionResult, type OrderIntentInput } from "./types";

function notConfigured(broker: string): ExecutionResult {
  return {
    success: false,
    fillPrice: null,
    brokerName: broker,
    message: `${broker} non configurato — imposta le API key in .env.local.`,
  };
}

export class CoinbaseBroker extends BaseBrokerAdapter {
  name = "coinbase";
  mode = "PAPER" as const;

  async placeOrder(intent: OrderIntentInput): Promise<ExecutionResult> {
    if (!process.env.COINBASE_API_KEY) {
      return notConfigured(this.name);
    }
    void intent;
    return {
      success: false,
      fillPrice: null,
      brokerName: this.name,
      message: "Coinbase adapter stub — integrazione non ancora attiva.",
    };
  }
}

export class KrakenBroker extends BaseBrokerAdapter {
  name = "kraken";
  mode = "PAPER" as const;

  async placeOrder(intent: OrderIntentInput): Promise<ExecutionResult> {
    if (!process.env.KRAKEN_API_KEY) {
      return notConfigured(this.name);
    }
    void intent;
    return {
      success: false,
      fillPrice: null,
      brokerName: this.name,
      message: "Kraken adapter stub — integrazione non ancora attiva.",
    };
  }
}

export class InteractiveBrokersBroker extends BaseBrokerAdapter {
  name = "interactive_brokers";
  mode = "PAPER" as const;

  async placeOrder(intent: OrderIntentInput): Promise<ExecutionResult> {
    if (!process.env.IB_GATEWAY_HOST) {
      return notConfigured(this.name);
    }
    void intent;
    return {
      success: false,
      fillPrice: null,
      brokerName: this.name,
      message: "Interactive Brokers adapter stub — integrazione non ancora attiva.",
    };
  }
}
