import type { AssetType, Bucket } from "@prisma/client";
import { evaluatePortfolio } from "./evaluatePortfolio";
import { runStressTest } from "./stressTest";
import type { AllocationSnapshot, OrderImpact } from "./types";

function toAllocationSnapshot(
  portfolio: ReturnType<typeof evaluatePortfolio>,
): AllocationSnapshot {
  return {
    bucketPcts: portfolio.bucketPcts,
    cryptoPct: portfolio.cryptoPct,
    experimentalPct: portfolio.bucketPcts.SPECULATIVE,
  };
}

export function simulateOrderImpact(input: {
  cashBalance: number;
  positions: Array<{
    assetId: string;
    symbol: string;
    quantity: number;
    avgPrice: number;
    currentPrice?: number;
    bucket: Bucket;
    assetType: AssetType;
  }>;
  order: {
    assetId: string;
    side: "BUY" | "SELL";
    quantity: number;
    limitPrice: number;
    bucket?: Bucket;
    assetType?: AssetType;
  };
}): OrderImpact {
  const before = evaluatePortfolio({
    cashBalance: input.cashBalance,
    positions: input.positions,
  });

  const orderAmount = input.order.quantity * input.order.limitPrice;
  const currentPosition = before.positionValues.find(
    (p) => p.assetId === input.order.assetId,
  );
  const positionValueBefore = currentPosition?.value ?? 0;

  const orderBucket =
    input.order.bucket ?? currentPosition?.bucket ?? "CORE";
  const orderAssetType =
    input.order.assetType ?? currentPosition?.assetType ?? "ETF";

  const updatedPositions = input.positions.map((position) => {
    if (position.assetId !== input.order.assetId) {
      return position;
    }

    const unitPrice = position.currentPrice ?? position.avgPrice;
    const newQuantity =
      input.order.side === "BUY"
        ? position.quantity + input.order.quantity
        : Math.max(0, position.quantity - input.order.quantity);

    if (newQuantity <= 0) {
      return null;
    }

    return {
      ...position,
      quantity: newQuantity,
      currentPrice: unitPrice,
    };
  });

  const positionsAfter = updatedPositions.filter(
    (p): p is NonNullable<typeof p> => p !== null,
  );

  if (
    input.order.side === "BUY" &&
    !input.positions.some((p) => p.assetId === input.order.assetId)
  ) {
    positionsAfter.push({
      assetId: input.order.assetId,
      symbol: "",
      quantity: input.order.quantity,
      avgPrice: input.order.limitPrice,
      currentPrice: input.order.limitPrice,
      bucket: orderBucket,
      assetType: orderAssetType,
    });
  }

  let cashAfter = input.cashBalance;
  if (input.order.side === "BUY") {
    cashAfter = input.cashBalance - orderAmount;
  } else {
    cashAfter = input.cashBalance + orderAmount;
  }

  const after = evaluatePortfolio({
    cashBalance: cashAfter,
    positions: positionsAfter,
  });

  const positionValueAfter =
    after.positionValues.find((p) => p.assetId === input.order.assetId)
      ?.value ?? 0;

  return {
    orderAmount,
    cashBefore: input.cashBalance,
    cashAfter,
    positionValueBefore,
    positionValueAfter,
    totalValueBefore: before.totalValue,
    totalValueAfter: after.totalValue,
    allocationBefore: toAllocationSnapshot(before),
    allocationAfter: toAllocationSnapshot(after),
    stressScenarios: runStressTest(after.totalValue),
  };
}
