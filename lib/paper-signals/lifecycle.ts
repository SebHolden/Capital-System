import type { PaperSignalStatus, PaperSignalType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { addDays } from "./utils";

export const CLOSE_REASON_HORIZON_30D = "HORIZON_30D";
export const CLOSE_REASON_OPPOSITE_SIGNAL = "OPPOSITE_SIGNAL";
export const CLOSE_REASON_EXPIRED = "EXPIRED";

const SIGNAL_EXPIRY_DAYS = 90;

export function isOppositeSignalType(
  a: PaperSignalType,
  b: PaperSignalType,
): boolean {
  if (a === "BUY" && b === "SELL") return true;
  if (a === "SELL" && b === "BUY") return true;
  return false;
}

export function resolveSignalStatus(input: {
  currentStatus: PaperSignalStatus;
  signalDate: Date;
  result30dPct: number | null;
  now: Date;
  hasOppositeSignal: boolean;
}): {
  status: PaperSignalStatus;
  closeReason: string | null;
  closedAt: Date | null;
} {
  const { currentStatus, signalDate, result30dPct, now, hasOppositeSignal } =
    input;

  if (currentStatus !== "OPEN") {
    return { status: currentStatus, closeReason: null, closedAt: null };
  }

  if (hasOppositeSignal) {
    return {
      status: "CLOSED",
      closeReason: CLOSE_REASON_OPPOSITE_SIGNAL,
      closedAt: now,
    };
  }

  if (result30dPct !== null) {
    return {
      status: "CLOSED",
      closeReason: CLOSE_REASON_HORIZON_30D,
      closedAt: now,
    };
  }

  if (addDays(signalDate, SIGNAL_EXPIRY_DAYS) < now) {
    return {
      status: "EXPIRED",
      closeReason: CLOSE_REASON_EXPIRED,
      closedAt: now,
    };
  }

  return { status: "OPEN", closeReason: null, closedAt: null };
}

export async function closeOppositeOpenSignals(
  input: {
    strategyId: string;
    assetId: string;
    newSignalType: PaperSignalType;
    now: Date;
  },
): Promise<number> {
  const { strategyId, assetId, newSignalType, now } = input;

  if (newSignalType !== "BUY" && newSignalType !== "SELL") {
    return 0;
  }

  const openSignals = await prisma.paperSignal.findMany({
    where: {
      strategyId,
      assetId,
      status: "OPEN",
    },
  });

  let closed = 0;
  for (const signal of openSignals) {
    if (!isOppositeSignalType(signal.signalType, newSignalType)) continue;

    await prisma.paperSignal.update({
      where: { id: signal.id },
      data: {
        status: "CLOSED",
        closeReason: CLOSE_REASON_OPPOSITE_SIGNAL,
        closedAt: now,
        lastMonitoredAt: now,
      },
    });
    closed += 1;
  }

  return closed;
}
