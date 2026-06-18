import type { AssetType, ExecutionMode } from "@prisma/client";

export interface OrderIntentInput {
  assetId: string;
  symbol: string;
  assetType?: AssetType;
  side: "BUY" | "SELL";
  quantity: number;
  limitPrice: number;
}

export interface ExecutionResult {
  success: boolean;
  fillPrice: number | null;
  message: string;
  brokerOrderId?: string;
  brokerName: string;
}

export interface BrokerAccount {
  cashBalance: number;
  currency: string;
}

export interface BrokerPosition {
  symbol: string;
  quantity: number;
  avgPrice: number;
}

export interface BrokerCancelResult {
  success: boolean;
  message: string;
}

export interface BrokerAdapter {
  name: string;
  mode: ExecutionMode;
  placeOrder(intent: OrderIntentInput): Promise<ExecutionResult>;
  getAccount(): Promise<BrokerAccount>;
  getPositions(): Promise<BrokerPosition[]>;
  cancelOrder(orderId: string): Promise<BrokerCancelResult>;
}

export abstract class BaseBrokerAdapter implements BrokerAdapter {
  abstract name: string;
  abstract mode: ExecutionMode;

  abstract placeOrder(intent: OrderIntentInput): Promise<ExecutionResult>;

  async getAccount(): Promise<BrokerAccount> {
    return { cashBalance: 0, currency: "EUR" };
  }

  async getPositions(): Promise<BrokerPosition[]> {
    return [];
  }

  async cancelOrder(orderId: string): Promise<BrokerCancelResult> {
    return {
      success: false,
      message: `Cancel non supportato da ${this.name} per ordine ${orderId}.`,
    };
  }
}
