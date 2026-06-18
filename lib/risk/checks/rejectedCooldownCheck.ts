import { prisma } from "@/lib/db";
import type { RiskCheckResult } from "./types";

export async function evaluateRejectedCooldownCheck(
  cooldownMinutes: number,
): Promise<RiskCheckResult> {
  if (cooldownMinutes <= 0) {
    return { reasons: [], warnings: [], block: false };
  }

  const since = new Date(Date.now() - cooldownMinutes * 60 * 1000);
  const recentRejected = await prisma.orderIntent.findFirst({
    where: {
      status: "REJECTED",
      createdAt: { gte: since },
    },
    orderBy: { createdAt: "desc" },
  });

  if (!recentRejected) {
    return { reasons: [], warnings: [], block: false };
  }

  return {
    reasons: [
      `Cooldown attivo: ordine rifiutato negli ultimi ${cooldownMinutes} minuti. Attendi prima di riprovare.`,
    ],
    warnings: [],
    block: true,
  };
}
