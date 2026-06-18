"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Modal } from "@/components/ui/Modal";
import { RiskBadge } from "@/components/ui/RiskBadge";
import { Select } from "@/components/ui/Select";
import { isJournalEligibleForOrder } from "@/lib/journal";
import { apiFetch } from "@/lib/client/apiFetch";
import { formatCurrency, formatPct } from "@/lib/utils";

interface Asset {
  id: string;
  symbol: string;
  name: string;
}

interface Journal {
  id: string;
  title: string;
  thesis: string;
  risks: string;
  invalidation: string;
  emotionalState: string;
  timeHorizon: string;
  maxAcceptableLoss: number;
  exitRule: string;
  emotionScore: number;
  confidenceScore: number;
  planned: boolean;
  isComplete: boolean;
}

interface RiskResult {
  level: string;
  reasons: string[];
  warnings: string[];
  blocked: boolean;
  allowedAmount: number;
  journalQualityScore?: number;
  journalLevel?: string;
  journalWarnings?: string[];
}

interface StressScenario {
  label: string;
  drawdownPct: number;
  portfolioValue: number;
  lossAmount: number;
}

interface AllocationSnapshot {
  bucketPcts: Record<string, number>;
  cryptoPct: number;
  experimentalPct: number;
}

interface OrderImpact {
  orderAmount: number;
  cashBefore: number;
  cashAfter: number;
  positionValueBefore: number;
  positionValueAfter: number;
  totalValueBefore: number;
  totalValueAfter: number;
  allocationBefore: AllocationSnapshot;
  allocationAfter: AllocationSnapshot;
  stressScenarios: StressScenario[];
}

interface ExecutionResult {
  orderIntentId?: string;
  idempotentReplay?: boolean;
  riskDecision: RiskResult;
  impact?: OrderImpact;
  execution?: {
    success: boolean;
    fillPrice: number | null;
    message: string;
  };
}

interface ChecklistItem {
  id: string;
  label: string;
  passed: boolean;
  required: boolean;
  detail?: string;
}

interface LiveChecklist {
  ready: boolean;
  items: ChecklistItem[];
  liveVolumes?: {
    dailyUsed: number;
    dailyLimit: number;
    monthlyUsed: number;
    monthlyLimit: number;
  };
}

export function OrdersClient({
  assets,
  journals,
  executionMode,
  liveTradingEnabled,
  killSwitchActive,
}: {
  assets: Asset[];
  journals: Journal[];
  executionMode: "MOCK" | "PAPER" | "LIVE";
  liveTradingEnabled: boolean;
  killSwitchActive: boolean;
}) {
  const eligibleJournals = journals.filter((j) => isJournalEligibleForOrder(j));

  const [form, setForm] = useState({
    assetId: assets[0]?.id ?? "",
    side: "BUY",
    quantity: "",
    limitPrice: "",
    journalId: eligibleJournals[0]?.id ?? "",
  });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ExecutionResult | null>(null);
  const [confirmRisk, setConfirmRisk] = useState(false);
  const [confirmLive, setConfirmLive] = useState(false);
  const [livePassphrase, setLivePassphrase] = useState("");
  const [liveChecklist, setLiveChecklist] = useState<LiveChecklist | null>(
    null,
  );
  const [liveModalOpen, setLiveModalOpen] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState(() =>
    crypto.randomUUID(),
  );

  const isLiveMode = executionMode === "LIVE";

  const executionLabel =
    executionMode === "LIVE"
      ? "LIVE"
      : executionMode === "PAPER"
        ? "PAPER"
        : "MOCK";

  useEffect(() => {
    if (!isLiveMode) {
      setLiveChecklist(null);
      return;
    }

    let cancelled = false;

    async function loadChecklist() {
      try {
        const res = await fetch("/api/live/checklist");
        const data = await res.json();
        if (!cancelled && res.ok) {
          setLiveChecklist(data);
        }
      } catch {
        if (!cancelled) setLiveChecklist(null);
      }
    }

    loadChecklist();
    return () => {
      cancelled = true;
    };
  }, [isLiveMode]);

  async function simulate() {
    setLoading(true);
    setResult(null);
    setConfirmRisk(false);
    setConfirmLive(false);
    setLivePassphrase("");
    setIdempotencyKey(crypto.randomUUID());
    try {
      const res = await apiFetch("/api/execution/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assetId: form.assetId,
          side: form.side,
          quantity: parseFloat(form.quantity),
          limitPrice: form.limitPrice ? parseFloat(form.limitPrice) : undefined,
          journalId: form.journalId || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(JSON.stringify(data.error));
      setResult(data);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Errore simulazione");
    } finally {
      setLoading(false);
    }
  }

  async function submitExecution() {
    setLoading(true);
    try {
      const body: Record<string, unknown> = {
        assetId: form.assetId,
        side: form.side,
        quantity: parseFloat(form.quantity),
        limitPrice: form.limitPrice ? parseFloat(form.limitPrice) : undefined,
        journalId: form.journalId,
        idempotencyKey,
        confirmRisk: true,
      };

      if (isLiveMode) {
        body.mode = "LIVE";
        body.confirmLive = true;
        body.livePassphrase = livePassphrase;
      }

      const res = await apiFetch("/api/execution", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(JSON.stringify(data.error ?? data));
      setResult(data);
      setLiveModalOpen(false);
      if (!data.idempotentReplay) {
        setIdempotencyKey(crypto.randomUUID());
        setLivePassphrase("");
        setConfirmLive(false);
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Errore esecuzione");
    } finally {
      setLoading(false);
    }
  }

  function openLiveModal() {
    if (!confirmRisk) {
      alert("Conferma la risk decision prima di eseguire l'ordine.");
      return;
    }
    if (liveChecklist && !liveChecklist.ready) {
      alert("Checklist LIVE incompleta. Risolvi i prerequisiti prima di eseguire.");
      return;
    }
    setConfirmLive(false);
    setLivePassphrase("");
    setLiveModalOpen(true);
  }

  async function executeOrder() {
    if (!confirmRisk) {
      alert("Conferma la risk decision prima di eseguire l'ordine.");
      return;
    }

    if (isLiveMode) {
      openLiveModal();
      return;
    }

    await submitExecution();
  }

  async function confirmLiveOrder() {
    if (!confirmLive) {
      alert("Conferma esplicita richiesta per ordini LIVE.");
      return;
    }
    if (!livePassphrase.trim()) {
      alert("Inserisci la passphrase live.");
      return;
    }
    await submitExecution();
  }

  const selectedAsset = assets.find((a) => a.id === form.assetId);
  const completeJournals = eligibleJournals;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">Ordini</h2>
        <p className="text-sm text-slate-400">
          Simulatore ordine con risk gate completo — allocazione, stress test e
          limiti perdita/drawdown
        </p>
      </div>

      {isLiveMode && killSwitchActive && (
        <div className="rounded-xl border border-red-800 bg-red-950/50 p-4">
          <p className="font-semibold text-red-300">Kill switch ATTIVO</p>
          <p className="text-sm text-red-400">
            Tutte le operazioni LIVE sono bloccate fino alla disattivazione in
            Settings.
          </p>
        </div>
      )}

      {isLiveMode && (
        <Card>
          <CardTitle>Prerequisiti LIVE</CardTitle>
          {!liveTradingEnabled && (
            <p className="mt-2 text-sm text-amber-400">
              ENABLE_LIVE_TRADING non è attivo sul server. Gli ordini LIVE
              verranno rifiutati.
            </p>
          )}
          {liveChecklist ? (
            <ul className="mt-4 space-y-2 text-sm">
              {liveChecklist.items.map((item) => (
                <li
                  key={item.id}
                  className={`flex flex-col gap-0.5 rounded-lg p-2 ${
                    item.passed
                      ? "bg-emerald-950/40 text-emerald-300"
                      : item.required
                        ? "bg-red-950/40 text-red-300"
                        : "bg-amber-950/30 text-amber-300"
                  }`}
                >
                  <span>
                    {item.passed ? "✓" : item.required ? "✗" : "⚠"}{" "}
                    {item.label}
                  </span>
                  {item.detail && (
                    <span className="text-xs opacity-80">{item.detail}</span>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-slate-400">
              Caricamento checklist…
            </p>
          )}
          {liveChecklist?.liveVolumes && (
            <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
              <div className="rounded-lg bg-slate-900 p-3">
                <p className="text-slate-500">Volume LIVE oggi</p>
                <p className="text-white">
                  {formatCurrency(liveChecklist.liveVolumes.dailyUsed)} /{" "}
                  {formatCurrency(liveChecklist.liveVolumes.dailyLimit)}
                </p>
              </div>
              <div className="rounded-lg bg-slate-900 p-3">
                <p className="text-slate-500">Volume LIVE mese</p>
                <p className="text-white">
                  {formatCurrency(liveChecklist.liveVolumes.monthlyUsed)} /{" "}
                  {formatCurrency(liveChecklist.liveVolumes.monthlyLimit)}
                </p>
              </div>
            </div>
          )}
          <p className="mt-3 text-xs text-slate-500">
            Ordini LIVE usano denaro reale via Alpaca. Solo simboli USA
            compatibili; ETF EU del seed non sono eseguibili.
          </p>
        </Card>
      )}

      <Card>
        <CardTitle>Simulatore ordine</CardTitle>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <Label>Asset</Label>
            <Select
              value={form.assetId}
              onChange={(e) => setForm({ ...form, assetId: e.target.value })}
            >
              {assets.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.symbol} — {a.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Lato</Label>
            <Select
              value={form.side}
              onChange={(e) => setForm({ ...form, side: e.target.value })}
            >
              <option value="BUY">BUY</option>
              <option value="SELL">SELL</option>
            </Select>
          </div>
          <div>
            <Label>Quantità</Label>
            <Input
              type="number"
              step="any"
              value={form.quantity}
              onChange={(e) => setForm({ ...form, quantity: e.target.value })}
            />
          </div>
          <div>
            <Label>Prezzo limite (opzionale)</Label>
            <Input
              type="number"
              step="any"
              value={form.limitPrice}
              onChange={(e) => setForm({ ...form, limitPrice: e.target.value })}
            />
          </div>
          <div className="sm:col-span-2">
            <Label>Journal decisionale</Label>
            <Select
              value={form.journalId}
              onChange={(e) => setForm({ ...form, journalId: e.target.value })}
            >
              <option value="">— Nessun journal —</option>
              {completeJournals.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.title}
                </option>
              ))}
            </Select>
            {completeJournals.length === 0 && (
              <p className="mt-1 text-xs text-amber-400">
                Nessun journal eleggibile: completa un journal con emotion score
                sotto 8 e tutti i campi obbligatori.
              </p>
            )}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          <Button onClick={simulate} disabled={loading || !form.quantity}>
            Valuta rischio
          </Button>
        </div>
      </Card>

      {result && (
        <>
          <Card>
            <CardTitle>Risk decision</CardTitle>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <RiskBadge level={result.riskDecision.level} />
              {result.riskDecision.blocked && (
                <span className="text-sm text-red-400">Ordine bloccato</span>
              )}
              {result.riskDecision.allowedAmount > 0 && (
                <span className="text-sm text-slate-400">
                  Importo massimo consentito:{" "}
                  {formatCurrency(result.riskDecision.allowedAmount)}
                </span>
              )}
              {result.riskDecision.journalQualityScore !== undefined && (
                <span className="text-sm text-slate-400">
                  Journal: {result.riskDecision.journalQualityScore}/100
                  {result.riskDecision.journalLevel &&
                    ` (${result.riskDecision.journalLevel})`}
                </span>
              )}
            </div>
            <ul className="mt-3 list-inside list-disc text-sm text-slate-400">
              {result.riskDecision.reasons.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
            {result.riskDecision.warnings.length > 0 && (
              <ul className="mt-2 list-inside list-disc text-sm text-amber-400">
                {result.riskDecision.warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            )}
            {result.riskDecision.journalWarnings &&
              result.riskDecision.journalWarnings.length > 0 && (
                <div className="mt-3 rounded-lg border border-amber-800/50 bg-amber-950/30 p-3">
                  <p className="text-sm font-medium text-amber-300">
                    Avvisi journal
                  </p>
                  <ul className="mt-2 list-inside list-disc text-sm text-amber-400">
                    {result.riskDecision.journalWarnings.map((w) => (
                      <li key={w}>{w}</li>
                    ))}
                  </ul>
                </div>
              )}
            {result.execution && (
              <div className="mt-4 rounded-lg bg-slate-900 p-3 text-sm">
                <p
                  className={
                    result.execution.success ? "text-green-400" : "text-red-400"
                  }
                >
                  {result.execution.message}
                </p>
                {result.execution.fillPrice && (
                  <p className="mt-1 text-slate-400">
                    Fill price: {formatCurrency(result.execution.fillPrice)}
                  </p>
                )}
              </div>
            )}
          </Card>

          {!result.execution && (
            <Card>
              <CardTitle>
                Conferma esecuzione ({executionLabel})
                {isLiveMode && (
                  <span className="ml-2 text-sm font-normal text-red-400">
                    — denaro reale
                  </span>
                )}
              </CardTitle>
              <p className="mt-2 text-sm text-slate-400">
                Rivedi la risk decision, poi conferma per eseguire in modalità{" "}
                {executionLabel}.
              </p>
              <label className="mt-4 flex cursor-pointer items-start gap-3 text-sm text-slate-300">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={confirmRisk}
                  onChange={(e) => setConfirmRisk(e.target.checked)}
                  disabled={result.riskDecision.blocked}
                />
                <span>
                  Confermo di aver letto la risk decision e accetto i limiti
                  impostati dal risk gate.
                </span>
              </label>
              <div className="mt-4">
                <Button
                  onClick={executeOrder}
                  variant={isLiveMode ? "danger" : "primary"}
                  disabled={
                    loading ||
                    !form.quantity ||
                    !form.journalId ||
                    result.riskDecision.blocked ||
                    !confirmRisk ||
                    (isLiveMode &&
                      (liveChecklist !== null && !liveChecklist.ready))
                  }
                >
                  {isLiveMode ? "Apri conferma LIVE" : `Esegui ${executionLabel}`}
                </Button>
              </div>
            </Card>
          )}

          {result.impact && (
            <Card>
              <CardTitle>Impatto ordine</CardTitle>
              <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                <div className="rounded-lg bg-slate-900 p-3">
                  <p className="text-slate-500">Importo ordine</p>
                  <p className="text-white">
                    {formatCurrency(result.impact.orderAmount)}
                  </p>
                </div>
                <div className="rounded-lg bg-slate-900 p-3">
                  <p className="text-slate-500">Liquidità</p>
                  <p className="text-white">
                    {formatCurrency(result.impact.cashBefore)} →{" "}
                    {formatCurrency(result.impact.cashAfter)}
                  </p>
                </div>
                <div className="rounded-lg bg-slate-900 p-3">
                  <p className="text-slate-500">Esposizione asset</p>
                  <p className="text-white">
                    {formatCurrency(result.impact.positionValueBefore)} →{" "}
                    {formatCurrency(result.impact.positionValueAfter)}
                  </p>
                </div>
                <div className="rounded-lg bg-slate-900 p-3">
                  <p className="text-slate-500">Patrimonio totale</p>
                  <p className="text-white">
                    {formatCurrency(result.impact.totalValueBefore)} →{" "}
                    {formatCurrency(result.impact.totalValueAfter)}
                  </p>
                </div>
              </div>

              <div className="mt-6">
                <p className="text-sm font-medium text-slate-400">
                  Allocazione prima / dopo
                </p>
                <div className="mt-2 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-700 text-left text-slate-500">
                        <th className="pb-2 pr-4">Metrica</th>
                        <th className="pb-2 pr-4">Prima</th>
                        <th className="pb-2">Dopo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(["CORE", "GROWTH", "SPECULATIVE", "HEDGE"] as const).map(
                        (bucket) => (
                          <tr key={bucket} className="border-b border-slate-800">
                            <td className="py-2 pr-4 text-slate-300">{bucket}</td>
                            <td className="py-2 pr-4 text-slate-400">
                              {formatPct(
                                result.impact!.allocationBefore.bucketPcts[
                                  bucket
                                ] ?? 0,
                              )}
                            </td>
                            <td className="py-2 text-white">
                              {formatPct(
                                result.impact!.allocationAfter.bucketPcts[
                                  bucket
                                ] ?? 0,
                              )}
                            </td>
                          </tr>
                        ),
                      )}
                      <tr className="border-b border-slate-800">
                        <td className="py-2 pr-4 text-slate-300">Crypto</td>
                        <td className="py-2 pr-4 text-slate-400">
                          {formatPct(result.impact.allocationBefore.cryptoPct)}
                        </td>
                        <td className="py-2 text-white">
                          {formatPct(result.impact.allocationAfter.cryptoPct)}
                        </td>
                      </tr>
                      <tr>
                        <td className="py-2 pr-4 text-slate-300">Experimental</td>
                        <td className="py-2 pr-4 text-slate-400">
                          {formatPct(
                            result.impact.allocationBefore.experimentalPct,
                          )}
                        </td>
                        <td className="py-2 text-white">
                          {formatPct(
                            result.impact.allocationAfter.experimentalPct,
                          )}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {result.impact.stressScenarios.length > 0 && (
                <div className="mt-6">
                  <p className="text-sm font-medium text-slate-400">
                    Stress test post-ordine
                  </p>
                  <div className="mt-2 overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-700 text-left text-slate-500">
                          <th className="pb-2 pr-4">Scenario</th>
                          <th className="pb-2 pr-4">Perdita</th>
                          <th className="pb-2">Valore residuo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.impact.stressScenarios.map((scenario) => (
                          <tr
                            key={scenario.label}
                            className="border-b border-slate-800"
                          >
                            <td className="py-2 pr-4 text-slate-300">
                              {scenario.label}
                            </td>
                            <td className="py-2 pr-4 text-red-400">
                              -{formatCurrency(scenario.lossAmount)}
                            </td>
                            <td className="py-2 text-slate-300">
                              {formatCurrency(scenario.portfolioValue)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </Card>
          )}
        </>
      )}

      <Modal
        open={liveModalOpen}
        onClose={() => setLiveModalOpen(false)}
        title="Conferma ordine LIVE"
      >
        {result && (
          <div className="space-y-4">
            <p className="text-sm text-red-400">
              Stai per eseguire un ordine con denaro reale. L&apos;operazione non
              è reversibile dall&apos;app.
            </p>
            <div className="rounded-lg bg-slate-950 p-4 text-sm">
              <div className="grid gap-2 sm:grid-cols-2">
                <p>
                  <span className="text-slate-500">Asset: </span>
                  <span className="text-white">
                    {selectedAsset?.symbol ?? "—"}
                  </span>
                </p>
                <p>
                  <span className="text-slate-500">Lato: </span>
                  <span className="text-white">{form.side}</span>
                </p>
                <p>
                  <span className="text-slate-500">Quantità: </span>
                  <span className="text-white">{form.quantity}</span>
                </p>
                <p>
                  <span className="text-slate-500">Importo stimato: </span>
                  <span className="text-white">
                    {result.impact
                      ? formatCurrency(result.impact.orderAmount)
                      : "—"}
                  </span>
                </p>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <span className="text-slate-500">Risk level:</span>
                <RiskBadge level={result.riskDecision.level} />
              </div>
            </div>
            <label className="flex cursor-pointer items-start gap-3 text-sm text-slate-300">
              <input
                type="checkbox"
                className="mt-1"
                checked={confirmLive}
                onChange={(e) => setConfirmLive(e.target.checked)}
              />
              <span>
                Confermo di voler eseguire questo ordine LIVE con denaro reale.
              </span>
            </label>
            <div>
              <Label>Passphrase live</Label>
              <Input
                type="password"
                autoComplete="off"
                value={livePassphrase}
                onChange={(e) => setLivePassphrase(e.target.value)}
                placeholder="LIVE_TRADING_PASSPHRASE (server)"
              />
              <p className="mt-1 text-xs text-slate-500">
                Inviata solo per questa richiesta; non salvata nel browser né
                nei log.
              </p>
            </div>
            <div className="flex justify-end gap-3">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setLiveModalOpen(false)}
                disabled={loading}
              >
                Annulla
              </Button>
              <Button
                type="button"
                variant="danger"
                onClick={confirmLiveOrder}
                disabled={
                  loading ||
                  !confirmLive ||
                  !livePassphrase.trim() ||
                  (liveChecklist !== null && !liveChecklist.ready)
                }
              >
                Esegui LIVE
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <p className="text-xs text-slate-500">
        Modalità esecuzione: {executionLabel}.
        {isLiveMode && " Ordini LIVE richiedono passphrase e checklist completa."}
      </p>
    </div>
  );
}
