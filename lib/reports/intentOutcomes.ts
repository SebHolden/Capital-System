import type { IntentOutcomeRow } from "./types";

interface BuildIntentOutcomesInput {
  since: Date;
  until: Date;
}

export async function buildIntentOutcomes(
  input: BuildIntentOutcomesInput,
): Promise<IntentOutcomeRow[]> {
  const { prisma } = await import("@/lib/db");

  const orders = await prisma.orderIntent.findMany({
    where: {
      createdAt: { gte: input.since, lte: input.until },
      status: "EXECUTED",
      journalId: { not: null },
    },
    include: {
      journal: true,
      asset: { select: { symbol: true } },
      executionLogs: {
        where: { status: "FILLED" },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return orders.map((order) => {
    const log = order.executionLogs[0];
    const fillPrice = log?.fillPrice ?? null;
    const pnlAmount =
      order.side === "SELL" && log
        ? (log.realizedPnl ??
          (log.costBasisPerUnit !== null && fillPrice !== null
            ? (fillPrice - log.costBasisPerUnit) * order.quantity
            : null))
        : null;

    const withinLossLimit =
      pnlAmount !== null && order.journal
        ? pnlAmount >= -order.journal.maxAcceptableLoss
        : null;

    let note = "Ordine eseguito con journal.";
    if (order.side === "BUY") {
      note = "Acquisto — PnL realizzato valutabile alla vendita.";
    } else if (pnlAmount !== null && order.journal) {
      note =
        withinLossLimit === false
          ? "Perdita oltre maxAcceptableLoss dichiarato nel journal."
          : "Vendita entro perdita massima accettabile.";
    }

    return {
      orderIntentId: order.id,
      symbol: order.asset.symbol,
      side: order.side,
      fillPrice,
      quantity: order.quantity,
      pnlAmount,
      maxAcceptableLoss: order.journal?.maxAcceptableLoss ?? 0,
      withinLossLimit,
      journalTitle: order.journal?.title ?? null,
      exitRule: order.journal?.exitRule ?? null,
      note,
    };
  });
}
