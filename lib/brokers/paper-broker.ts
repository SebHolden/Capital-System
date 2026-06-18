import { AlpacaBroker, isAlpacaCompatibleSymbol, isAlpacaConfigured } from "./alpaca-broker";
import { BaseBrokerAdapter, type ExecutionResult, type OrderIntentInput } from "./types";

export class PaperBroker extends BaseBrokerAdapter {
  name = "paper";
  mode = "PAPER" as const;
  private alpaca = new AlpacaBroker();

  async placeOrder(intent: OrderIntentInput): Promise<ExecutionResult> {
    if (
      isAlpacaConfigured() &&
      isAlpacaCompatibleSymbol(intent.symbol, intent.assetType)
    ) {
      const alpacaResult = await this.alpaca.placeOrder(intent);
      if (alpacaResult.success) {
        return alpacaResult;
      }
    }

    const slippage = intent.limitPrice * 0.001;
    const fillPrice =
      intent.side === "BUY"
        ? intent.limitPrice + slippage
        : intent.limitPrice - slippage;

    const brokerOrderId = `paper_sim_${Date.now()}`;

    return {
      success: true,
      fillPrice,
      brokerOrderId,
      brokerName: this.name,
      message: `Paper fill (simulato): ${intent.side} ${intent.quantity} ${intent.symbol} @ €${fillPrice.toFixed(2)} (slippage simulato)`,
    };
  }
}
