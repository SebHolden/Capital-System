"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardTitle, CardValue } from "@/components/ui/Card";
import { RiskBadge } from "@/components/ui/RiskBadge";
import type { DailyDecisionBrief } from "@/lib/autopilot";
import { apiFetch } from "@/lib/client/apiFetch";
import { formatCurrency, formatPct } from "@/lib/utils";
import type { RiskLevel } from "@prisma/client";

const ACTION_LABELS: Record<
  DailyDecisionBrief["actions"][number]["classification"],
  string
> = {
  DO_NOTHING: "Non fare nulla",
  WATCH: "Osservare",
  REVIEW_MANUALLY: "Revisione manuale",
  PAPER_ONLY: "Solo paper",
  MANUAL_APPROVAL_REQUIRED: "Approvazione manuale",
};

const ACTION_VARIANTS: Record<
  DailyDecisionBrief["actions"][number]["classification"],
  "muted" | "warning" | "success" | "danger"
> = {
  DO_NOTHING: "muted",
  WATCH: "warning",
  REVIEW_MANUALLY: "warning",
  PAPER_ONLY: "success",
  MANUAL_APPROVAL_REQUIRED: "success",
};

export function AutopilotClient({
  initialBrief,
}: {
  initialBrief: DailyDecisionBrief;
}) {
  const router = useRouter();
  const [brief, setBrief] = useState(initialBrief);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleRunDaily() {
    setLoading(true);
    setMessage(null);
    try {
      const res = await apiFetch("/api/autopilot/run-daily", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Errore workflow");
      setBrief(data.brief);
      setMessage(data.message ?? "Workflow completato.");
      router.refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Errore");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">Autopilot</h2>
          <p className="text-sm text-slate-400">
            Decision brief giornaliero — il sistema lavora in paper, tu approvi
            solo ciò che conta. Nessuna esecuzione live automatica.
          </p>
        </div>
        <Button variant="secondary" onClick={handleRunDaily} disabled={loading}>
          {loading ? "Esecuzione..." : "Esegui workflow giornaliero"}
        </Button>
      </div>

      {message && (
        <div className="rounded-xl border border-blue-800 bg-blue-950/40 p-4 text-sm text-blue-300">
          {message}
        </div>
      )}

      <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-4">
        <p className="font-semibold text-slate-200">Stato sistema</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Badge variant={brief.systemStatus.killSwitchActive ? "danger" : "success"}>
            Kill switch: {brief.systemStatus.killSwitchActive ? "ON" : "OFF"}
          </Badge>
          <Badge variant="muted">
            Execution: {brief.systemStatus.executionMode}
          </Badge>
          <Badge
            variant={brief.systemStatus.liveTradingEnabled ? "danger" : "success"}
          >
            Live trading:{" "}
            {brief.systemStatus.liveTradingEnabled ? "ABILITATO" : "DISABILITATO"}
          </Badge>
          {brief.systemStatus.lastWorkflowAt && (
            <Badge variant="muted">
              Ultimo workflow:{" "}
              {new Date(brief.systemStatus.lastWorkflowAt).toLocaleString("it-IT")}
            </Badge>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-amber-800 bg-amber-950/30 p-4">
        <p className="font-semibold text-amber-200">Avvisi di sicurezza</p>
        <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-amber-300/90">
          {brief.safetyNotice.messages.map((msg) => (
            <li key={msg}>{msg}</li>
          ))}
        </ul>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardTitle>Patrimonio</CardTitle>
          <CardValue>{formatCurrency(brief.portfolio.totalValue)}</CardValue>
        </Card>
        <Card>
          <CardTitle>PnL giornaliero</CardTitle>
          <CardValue
            className={
              brief.portfolio.dailyPnlPct >= 0 ? "text-green-400" : "text-red-400"
            }
          >
            {formatPct(brief.portfolio.dailyPnlPct)}
          </CardValue>
        </Card>
        <Card>
          <CardTitle>Drawdown</CardTitle>
          <CardValue>{formatPct(brief.portfolio.drawdownPct)}</CardValue>
        </Card>
        <Card>
          <CardTitle>Rischio</CardTitle>
          <div className="mt-2">
            <RiskBadge level={brief.riskStatus.level as RiskLevel} />
          </div>
        </Card>
      </div>

      {brief.doNothingReason && (
        <Card>
          <CardTitle>Perché non fare nulla</CardTitle>
          <p className="mt-2 text-sm text-slate-300">{brief.doNothingReason}</p>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardTitle>Cosa è successo</CardTitle>
          <ul className="mt-3 list-inside list-disc space-y-1 text-sm text-slate-300">
            {brief.whatHappened.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </Card>

        <Card>
          <CardTitle>Cosa richiede attenzione</CardTitle>
          <ul className="mt-3 list-inside list-disc space-y-1 text-sm text-amber-300/90">
            {brief.whatRequiresAttention.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardTitle>Cosa NON fare</CardTitle>
          <ul className="mt-3 list-inside list-disc space-y-1 text-sm text-red-400/90">
            {brief.whatNotToDo.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </Card>

        <Card>
          <CardTitle>Avvisi rischio</CardTitle>
          <ul className="mt-3 list-inside list-disc space-y-1 text-sm text-slate-300">
            {brief.warnings.length > 0 ? (
              brief.warnings.map((item) => <li key={item}>{item}</li>)
            ) : (
              <li className="text-slate-500">Nessun avviso attivo.</li>
            )}
          </ul>
        </Card>
      </div>

      <Card>
        <CardTitle>Azioni suggerite (max 3)</CardTitle>
        <p className="mt-1 text-xs text-slate-500">
          Classificazione analitica — nessuna azione esegue ordini live.
        </p>
        <ul className="mt-4 space-y-3">
          {brief.actions.map((action, index) => (
            <li
              key={action.id}
              className="rounded-lg border border-slate-700 bg-slate-900/50 p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium text-white">
                  {index + 1}. {action.title}
                </span>
                <Badge variant={ACTION_VARIANTS[action.classification]}>
                  {ACTION_LABELS[action.classification]}
                </Badge>
              </div>
              <p className="mt-2 text-sm text-slate-400">{action.description}</p>
              {action.maxAmountEur !== undefined && (
                <p className="mt-1 text-xs text-slate-500">
                  Importo massimo indicativo: {formatCurrency(action.maxAmountEur)}
                </p>
              )}
              <p className="mt-1 text-xs text-slate-500">{action.reason}</p>
            </li>
          ))}
        </ul>
      </Card>

      <Card>
        <CardTitle>Strategie paper</CardTitle>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg bg-slate-900 p-3 text-sm">
            <p className="text-slate-500">Migliore per score</p>
            <p className="text-white">
              {brief.strategies.bestByScore
                ? `${brief.strategies.bestByScore.name} (${brief.strategies.bestByScore.score})`
                : "N/D"}
            </p>
          </div>
          <div className="rounded-lg bg-slate-900 p-3 text-sm">
            <p className="text-slate-500">Peggiore per score</p>
            <p className="text-white">
              {brief.strategies.worstByScore
                ? `${brief.strategies.worstByScore.name} (${brief.strategies.worstByScore.score})`
                : "N/D"}
            </p>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-sm">
          <Badge variant="success">
            Promosse oggi: {brief.strategies.promotedToday.length}
          </Badge>
          <Badge variant="danger">
            Degradate oggi: {brief.strategies.degradedToday.length}
          </Badge>
          <Badge variant="muted">
            Segnali aperti: {brief.paperSignals.openTotal}
          </Badge>
        </div>
      </Card>
    </div>
  );
}
