import { randomUUID } from "crypto";
import { prisma } from "@/lib/db";
import { BaseBrokerAdapter, type ExecutionResult, type OrderIntentInput } from "./types";

export class MockBroker extends BaseBrokerAdapter {
  name = "mock";
  mode = "MOCK" as const;

  async getAccount() {
    const settings = await prisma.userSettings.findUnique({
      where: { id: "default" },
    });
    return {
      cashBalance: settings?.cashBalance ?? 0,
      currency: "EUR",
    };
  }

  async getPositions() {
    const positions = await prisma.position.findMany({
      include: { asset: true },
    });
    return positions.map((p) => ({
      symbol: p.asset.symbol,
      quantity: p.quantity,
      avgPrice: p.avgPrice,
    }));
  }

  async cancelOrder(orderId: string) {
    return {
      success: true,
      message: `Mock cancel accettato per ${orderId}.`,
    };
  }

  async placeOrder(intent: OrderIntentInput): Promise<ExecutionResult> {
    if (intent.quantity <= 0) {
      return {
        success: false,
        fillPrice: null,
        message: "Quantità non valida: deve essere maggiore di zero.",
        brokerName: this.name,
      };
    }

    if (intent.limitPrice <= 0) {
      return {
        success: false,
        fillPrice: null,
        message: "Prezzo limite non valido: deve essere maggiore di zero.",
        brokerName: this.name,
      };
    }

    const brokerOrderId = `mock_${randomUUID()}`;

    return {
      success: true,
      fillPrice: intent.limitPrice,
      brokerOrderId,
      brokerName: this.name,
      message: `Mock fill: ${intent.side} ${intent.quantity} ${intent.symbol} @ €${intent.limitPrice.toFixed(2)} (ref ${brokerOrderId})`,
    };
  }
}
