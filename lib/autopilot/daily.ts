import type { RiskLevel } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getPortfolioSummary } from "@/lib/portfolio";
import { getPaperStrategyRankings } from "@/lib/paper-signals";
import { runPaperSignalsPipeline } from "@/lib/paper-signals";
import { refreshPrices } from "@/lib/prices/service";
import {
  getUserSettings,
  isLiveTradingEnabled,
  writeAuditLog,
} from "@/lib/security";
import { dayBoundsFromDateKey, getDateKeyInTimezone } from "@/lib/reports/utils";
import type {
  ActionClassification,
  DailyDecisionBrief,
  DailyWorkflowResult,
  SuggestedAction,
  SafetyNotice,
} from "./types";
import { SAFETY_MESSAGES } from "./types";

const AUTOPILOT_BRIEF_ACTION = "AUTOPILOT_DAILY_BRIEF";

export function classifyAction(input: {
  riskLevel: RiskLevel;
  killSwitchActive: boolean;
  liveTradingEnabled: boolean;
  hasStalePrices: boolean;
  strategyPromoted?: boolean;
  isCoreDca?: boolean;
  isAggressiveStrategy?: boolean;
}): ActionClassification {
  if (input.killSwitchActive || input.riskLevel === "BLACK" || input.riskLevel === "RED") {
    return "DO_NOTHING";
  }

  if (input.hasStalePrices || input.riskLevel === "YELLOW" || input.riskLevel === "ORANGE") {
    if (input.isAggressiveStrategy) {
      return "WATCH";
    }
  }

  if (input.strategyPromoted) {
    return "REVIEW_MANUALLY";
  }

  if (input.isCoreDca && input.riskLevel === "GREEN" && !input.hasStalePrices) {
    return "MANUAL_APPROVAL_REQUIRED";
  }

  if (input.isAggressiveStrategy) {
    return "WATCH";
  }

  return "PAPER_ONLY";
}

function buildSafetyNotice(executionMode: "MOCK" | "PAPER" | "LIVE"): SafetyNotice {
  const liveDisabled = !isLiveTradingEnabled();
  const messages: string[] = [...SAFETY_MESSAGES];

  if (liveDisabled) {
    messages.push("ENABLE_LIVE_TRADING=false — nessuna esecuzione live consentita.");
  }

  if (executionMode !== "LIVE") {
    messages.push(`Execution mode attivo: ${executionMode} — solo simulazione/paper.`);
  }

  return {
    liveTradingDisabled: liveDisabled,
    executionMode,
    messages,
  };
}

export function generateSuggestedActions(input: {
  riskLevel: RiskLevel;
  killSwitchActive: boolean;
  liveTradingEnabled: boolean;
  priceWarnings: Array<{ symbol: string; status: string }>;
  rankings: Awaited<ReturnType<typeof getPaperStrategyRankings>>;
  promotedToday: string[];
  degradedToday: string[];
  newSignalsToday: number;
  maxOrderAmount: number;
}): { actions: SuggestedAction[]; doNothingReason: string | null } {
  const actions: SuggestedAction[] = [];
  let doNothingReason: string | null = null;

  const hasStalePrices = input.priceWarnings.length > 0;

  if (input.killSwitchActive) {
    doNothingReason = "Kill switch attivo: nessuna operazione consentita.";
    actions.push({
      id: "do-nothing-kill-switch",
      title: "Nessun acquisto core",
      description: "Kill switch attivo — tutte le operazioni sono bloccate.",
      classification: "DO_NOTHING",
      riskLevel: "BLACK",
      reason: doNothingReason,
    });
  } else if (input.riskLevel === "RED" || input.riskLevel === "BLACK") {
    doNothingReason = `Rischio ${input.riskLevel}: operazioni BUY bloccate dal risk gate.`;
    actions.push({
      id: "do-nothing-risk",
      title: "Nessun acquisto core",
      description: doNothingReason,
      classification: "DO_NOTHING",
      riskLevel: input.riskLevel,
      reason: doNothingReason,
    });
  } else if (hasStalePrices) {
    doNothingReason = "Prezzi stale o mancanti — attendere refresh dati affidabile.";
    actions.push({
      id: "do-nothing-stale-prices",
      title: "Nessun acquisto core",
      description: `${input.priceWarnings.length} asset con prezzo stale/mancante.`,
      classification: "DO_NOTHING",
      riskLevel: input.riskLevel,
      reason: doNothingReason,
    });
  }

  for (const ranking of input.rankings.slice(0, 5)) {
    const isAggressive =
      ranking.strategyName.toLowerCase().includes("dip") ||
      ranking.strategyName.toLowerCase().includes("momentum") ||
      ranking.strategyName.toLowerCase().includes("crypto");

    const isCoreDca =
      ranking.strategyName.toLowerCase().includes("dca") ||
      ranking.strategyName.toLowerCase().includes("core");

    const promotedToday = input.promotedToday.includes(ranking.strategyId);
    const classification = classifyAction({
      riskLevel: input.riskLevel,
      killSwitchActive: input.killSwitchActive,
      liveTradingEnabled: input.liveTradingEnabled,
      hasStalePrices,
      strategyPromoted: promotedToday || ranking.status === "PROMOTED",
      isCoreDca,
      isAggressiveStrategy: isAggressive,
    });

    if (classification === "DO_NOTHING") continue;

    const maxAmount = Math.min(
      input.maxOrderAmount,
      isAggressive ? Math.round(input.maxOrderAmount * 0.12) : input.maxOrderAmount,
    );

    actions.push({
      id: `strategy-${ranking.strategyId}`,
      title: `${ranking.strategyName}${promotedToday ? " (promossa oggi)" : ""}`,
      description:
        promotedToday || ranking.status === "PROMOTED"
          ? "Strategia promossa in paper — valutazione analitica, non autorizza live."
          : `Score ${ranking.score} · rating ${ranking.rating} · raccomandazione ${ranking.recommendation}`,
      classification,
      riskLevel: input.riskLevel,
      strategyName: ranking.strategyName,
      maxAmountEur: maxAmount,
      reason:
        classification === "WATCH"
          ? "Solo osservare — rischio elevato o strategia aggressiva."
          : classification === "MANUAL_APPROVAL_REQUIRED"
            ? "Puoi approvare manualmente se risk GREEN e prezzi fresh."
            : classification === "REVIEW_MANUALLY"
              ? "Revisione manuale richiesta — promozione paper non implica esecuzione."
              : "Segnale paper only — nessun ordine automatico.",
    });
  }

  if (input.newSignalsToday > 0 && actions.length < 3) {
    actions.push({
      id: "paper-signals-new",
      title: `${input.newSignalsToday} nuovi segnali paper oggi`,
      description: "I segnali paper sono analitici — non vengono eseguiti come ordini.",
      classification: "PAPER_ONLY",
      riskLevel: input.riskLevel,
      reason: "Monitoraggio paper only.",
    });
  }

  if (input.degradedToday.length > 0 && actions.length < 3) {
    actions.push({
      id: "strategies-degraded",
      title: `${input.degradedToday.length} strategie degradate oggi`,
      description: "Verifica motivi degrado in /strategies — nessuna azione live suggerita.",
      classification: "REVIEW_MANUALLY",
      riskLevel: input.riskLevel,
      reason: "Degrado strategia richiede revisione manuale.",
    });
  }

  const topActions = actions.slice(0, 3);

  if (topActions.length === 0 && !doNothingReason) {
    doNothingReason = "Nessuna azione urgente — condizioni stabili, solo monitoraggio.";
    topActions.push({
      id: "do-nothing-stable",
      title: "Nessuna azione richiesta",
      description: doNothingReason,
      classification: "DO_NOTHING",
      riskLevel: input.riskLevel,
      reason: doNothingReason,
    });
  }

  return { actions: topActions, doNothingReason };
}

async function countPaperSignalActivity(dateKey: string) {
  const { since, until } = dayBoundsFromDateKey(dateKey);

  const [newToday, closedToday, openTotal] = await Promise.all([
    prisma.paperSignal.count({
      where: { createdAt: { gte: since, lte: until } },
    }),
    prisma.paperSignal.count({
      where: {
        closedAt: { gte: since, lte: until },
        status: { in: ["CLOSED", "EXPIRED"] },
      },
    }),
    prisma.paperSignal.count({
      where: { status: "OPEN" },
    }),
  ]);

  return { newToday, closedToday, openTotal };
}

async function getPromotedDegradedNames(
  promotedIds: string[],
  degradedIds: string[],
): Promise<{ promotedToday: string[]; degradedToday: string[] }> {
  const allIds = [...promotedIds, ...degradedIds];
  if (allIds.length === 0) {
    return { promotedToday: [], degradedToday: [] };
  }

  const strategies = await prisma.strategy.findMany({
    where: { id: { in: allIds } },
    select: { id: true, name: true },
  });

  const nameById = new Map(strategies.map((s) => [s.id, s.name]));

  return {
    promotedToday: promotedIds.map((id) => nameById.get(id) ?? id),
    degradedToday: degradedIds.map((id) => nameById.get(id) ?? id),
  };
}

async function getLastWorkflowTimestamp(): Promise<string | null> {
  const last = await prisma.auditLog.findFirst({
    where: { action: AUTOPILOT_BRIEF_ACTION },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  return last?.createdAt.toISOString() ?? null;
}

export async function buildDailyDecisionBrief(options?: {
  dateKey?: string;
  workflow?: DailyWorkflowResult;
}): Promise<DailyDecisionBrief> {
  const settings = await getUserSettings();
  const dateKey =
    options?.dateKey ?? getDateKeyInTimezone(settings.tradingTimezone);
  const generatedAt = new Date().toISOString();

  const [summary, rankings, signalCounts, lastWorkflowAt] = await Promise.all([
    getPortfolioSummary(),
    getPaperStrategyRankings(),
    countPaperSignalActivity(dateKey),
    getLastWorkflowTimestamp(),
  ]);

  const promotedIds = options?.workflow?.paperSignals.promoted ?? [];
  const degradedIds = options?.workflow?.paperSignals.degraded ?? [];
  const { promotedToday, degradedToday } = await getPromotedDegradedNames(
    promotedIds,
    degradedIds,
  );

  const bestByScore = rankings[0]
    ? {
        name: rankings[0].strategyName,
        score: rankings[0].score,
        rating: rankings[0].rating,
      }
    : null;

  const worstByScore =
    rankings.length > 0
      ? (() => {
          const worst = rankings[rankings.length - 1];
          return {
            name: worst.strategyName,
            score: worst.score,
            rating: worst.rating,
          };
        })()
      : null;

  const priceWarnings = summary.priceWarnings.map((p) => ({
    symbol: p.asset.symbol,
    status: p.priceStatus,
  }));

  const { actions, doNothingReason } = generateSuggestedActions({
    riskLevel: summary.risk.level,
    killSwitchActive: summary.settings.killSwitchActive,
    liveTradingEnabled: isLiveTradingEnabled(),
    priceWarnings,
    rankings,
    promotedToday,
    degradedToday,
    newSignalsToday: signalCounts.newToday,
    maxOrderAmount: summary.settings.maxOrderAmount,
  });

  const whatHappened: string[] = [];
  if (options?.workflow) {
    whatHappened.push(
      `Prezzi aggiornati: ${options.workflow.prices.refreshed} asset (${options.workflow.prices.failed} falliti).`,
    );
    whatHappened.push(
      `Segnali paper: ${options.workflow.paperSignals.created} creati, ${options.workflow.paperSignals.skipped} saltati.`,
    );
    whatHappened.push(
      `Metriche aggiornate: ${options.workflow.paperSignals.metricsUpdated} segnali.`,
    );
    whatHappened.push(
      `Valutazioni sincronizzate: ${options.workflow.paperSignals.evaluationsSynced} strategie.`,
    );
  } else {
    whatHappened.push("Brief generato da snapshot corrente (workflow non eseguito in questa sessione).");
  }

  whatHappened.push(
    `${signalCounts.newToday} nuovi segnali oggi · ${signalCounts.closedToday} chiusi · ${signalCounts.openTotal} aperti.`,
  );

  if (promotedToday.length > 0) {
    whatHappened.push(`Promosse in paper: ${promotedToday.join(", ")}.`);
  }
  if (degradedToday.length > 0) {
    whatHappened.push(`Degradate: ${degradedToday.join(", ")}.`);
  }

  const whatRequiresAttention: string[] = [];
  if (summary.settings.killSwitchActive) {
    whatRequiresAttention.push("Kill switch ATTIVO.");
  }
  if (summary.risk.warnings.length > 0) {
    whatRequiresAttention.push(...summary.risk.warnings);
  }
  if (priceWarnings.length > 0) {
    whatRequiresAttention.push(
      `${priceWarnings.length} asset con prezzo stale/mancante.`,
    );
  }
  if (promotedToday.length > 0) {
    whatRequiresAttention.push(
      `Strategie promosse oggi (solo analitico): ${promotedToday.join(", ")}.`,
    );
  }
  if (degradedToday.length > 0) {
    whatRequiresAttention.push(`Strategie degradate: ${degradedToday.join(", ")}.`);
  }
  if (whatRequiresAttention.length === 0) {
    whatRequiresAttention.push("Nessuna urgenza — revisione routine sufficiente.");
  }

  const whatNotToDo: string[] = [
    "Non eseguire ordini live in autonomia.",
    "Non trattare segnali paper come ordini.",
    "Non assumere che strategia PROMOTED autorizzi trading reale.",
  ];

  if (summary.settings.killSwitchActive) {
    whatNotToDo.push("Non disattivare il kill switch senza revisione consapevole.");
  }
  if (priceWarnings.length > 0) {
    whatNotToDo.push("Non comprare asset con prezzo stale o mancante.");
  }
  if (summary.risk.level === "RED" || summary.risk.level === "BLACK") {
    whatNotToDo.push("Non ignorare il blocco risk gate (RED/BLACK).");
  }
  whatNotToDo.push(...summary.operations.blocked.map((op) => `Evitare: ${op}`));

  const warnings = [
    ...summary.risk.reasons,
    ...summary.risk.warnings,
    ...priceWarnings.map((p) => `Prezzo ${p.symbol}: ${p.status}`),
  ];

  const safetyNotice = buildSafetyNotice(summary.settings.executionMode);

  return {
    date: dateKey,
    generatedAt,
    portfolio: {
      totalValue: summary.portfolio.totalValue,
      dailyPnlPct: summary.riskMetrics.daily.pnlPct,
      monthlyPnlPct: summary.riskMetrics.monthly.pnlPct,
      drawdownPct: summary.riskMetrics.drawdown.drawdownPct,
    },
    riskStatus: {
      level: summary.risk.level,
      killSwitchActive: summary.settings.killSwitchActive,
      tradingWindowAllowed: summary.tradingWindow.allowed,
      reasons: summary.risk.reasons,
      warnings: summary.risk.warnings,
    },
    paperSignals: signalCounts,
    strategies: {
      bestByScore,
      worstByScore,
      promotedToday,
      degradedToday,
    },
    whatHappened,
    whatRequiresAttention,
    whatNotToDo,
    warnings,
    doNothingReason,
    actions,
    systemStatus: {
      executionMode: summary.settings.executionMode,
      liveTradingEnabled: isLiveTradingEnabled(),
      killSwitchActive: summary.settings.killSwitchActive,
      lastWorkflowAt: options?.workflow ? generatedAt : lastWorkflowAt,
    },
    safetyNotice,
    workflow: options?.workflow,
  };
}

export async function persistDailyDecisionBrief(
  brief: DailyDecisionBrief,
): Promise<void> {
  await writeAuditLog(AUTOPILOT_BRIEF_ACTION, "DailyDecisionBrief", {
    date: brief.date,
    generatedAt: brief.generatedAt,
    brief,
  });
}

export async function getLatestDailyDecisionBrief(): Promise<DailyDecisionBrief | null> {
  const last = await prisma.auditLog.findFirst({
    where: { action: AUTOPILOT_BRIEF_ACTION },
    orderBy: { createdAt: "desc" },
  });

  if (!last) return null;

  try {
    const payload = JSON.parse(last.payload) as { brief?: DailyDecisionBrief };
    return payload.brief ?? null;
  } catch {
    return null;
  }
}

export async function runDailyWorkflow(): Promise<{
  brief: DailyDecisionBrief;
  workflow: DailyWorkflowResult;
}> {
  const settings = await getUserSettings();
  const dateKey = getDateKeyInTimezone(settings.tradingTimezone);

  const priceResult = await refreshPrices();
  const pipelineResult = await runPaperSignalsPipeline();

  const workflow: DailyWorkflowResult = {
    prices: {
      refreshed: priceResult.refreshed,
      failed: priceResult.failed,
    },
    paperSignals: {
      created: pipelineResult.generated.created,
      skipped: pipelineResult.generated.skipped,
      metricsUpdated: pipelineResult.refreshed.updated,
      promoted: pipelineResult.promotion.promoted,
      degraded: pipelineResult.degradation.degraded,
      evaluationsSynced: pipelineResult.evaluationsSynced,
    },
  };

  const brief = await buildDailyDecisionBrief({ dateKey, workflow });
  await persistDailyDecisionBrief(brief);

  await writeAuditLog("AUTOPILOT_DAILY_WORKFLOW", "Autopilot", {
    date: dateKey,
    pricesRefreshed: workflow.prices.refreshed,
    signalsCreated: workflow.paperSignals.created,
    promoted: workflow.paperSignals.promoted,
    degraded: workflow.paperSignals.degraded,
    liveTradingEnabled: isLiveTradingEnabled(),
    executionMode: settings.executionMode,
  });

  return { brief, workflow };
}
