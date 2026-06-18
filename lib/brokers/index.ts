import type { ExecutionMode } from "@prisma/client";
import { LiveBroker } from "./live-broker";
import { MockBroker } from "./mock-broker";
import { PaperBroker } from "./paper-broker";
import {
  CoinbaseBroker,
  InteractiveBrokersBroker,
  KrakenBroker,
} from "./stub-brokers";
import type { BrokerAdapter } from "./types";

export type {
  BrokerAdapter,
  OrderIntentInput,
  ExecutionResult,
  BrokerAccount,
  BrokerPosition,
  BrokerCancelResult,
} from "./types";
export { AlpacaBroker, AlpacaLiveBroker, isAlpacaConfigured, isAlpacaCompatibleSymbol } from "./alpaca-broker";
export { CoinbaseBroker, KrakenBroker, InteractiveBrokersBroker } from "./stub-brokers";

export function getBroker(mode: ExecutionMode): BrokerAdapter {
  switch (mode) {
    case "PAPER":
      return new PaperBroker();
    case "LIVE":
      return new LiveBroker();
    case "MOCK":
    default:
      return new MockBroker();
  }
}

export function getBrokerByName(name: string): BrokerAdapter | null {
  switch (name.toLowerCase()) {
    case "mock":
      return new MockBroker();
    case "paper":
      return new PaperBroker();
    case "live":
      return new LiveBroker();
    case "coinbase":
      return new CoinbaseBroker();
    case "kraken":
      return new KrakenBroker();
    case "interactive_brokers":
    case "ib":
      return new InteractiveBrokersBroker();
    default:
      return null;
  }
}

export function listAvailableBrokers(): string[] {
  return ["mock", "paper", "live", "coinbase", "kraken", "interactive_brokers"];
}
