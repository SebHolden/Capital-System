"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Select } from "@/components/ui/Select";
import { formatCurrency } from "@/lib/utils";
import { apiFetch } from "@/lib/client/apiFetch";

interface Settings {
  id: string;
  hypotheticalCapital: number;
  cashBalance: number;
  executionMode: string;
  killSwitchActive: boolean;
  maxPositionPct: number;
  maxBucketPct: number;
  maxDailyOrders: number;
  maxOrderAmount: number;
  maxLiveOrderAmount: number;
  maxDailyLiveAmount: number;
  maxMonthlyLiveAmount: number;
  minCashReserve: number;
  maxCryptoPct: number;
  maxDailyLossPct: number;
  maxMonthlyLossPct: number;
  maxExperimentalPct: number;
  maxDrawdownPct: number;
  tradingWindowEnabled: boolean;
  tradingStartHour: number;
  tradingEndHour: number;
  tradingTimezone: string;
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
}

interface BrokerSnapshot {
  id: string;
  brokerName: string;
  mode: string;
  equity: number;
  cash: number;
  buyingPower: number | null;
  currency: string;
  capturedAt: string;
}

export function SettingsClient({
  initialSettings,
  liveTradingEnabled,
}: {
  initialSettings: Settings;
  liveTradingEnabled: boolean;
}) {
  const router = useRouter();
  const [settings, setSettings] = useState(initialSettings);
  const [loading, setLoading] = useState(false);
  const [liveChecklist, setLiveChecklist] = useState<LiveChecklist | null>(
    null,
  );
  const [brokerSnapshot, setBrokerSnapshot] = useState<BrokerSnapshot | null>(
    null,
  );
  const [brokerSyncing, setBrokerSyncing] = useState(false);
  const [form, setForm] = useState({
    maxPositionPct: String(settings.maxPositionPct),
    maxBucketPct: String(settings.maxBucketPct),
    maxDailyOrders: String(settings.maxDailyOrders),
    maxOrderAmount: String(settings.maxOrderAmount),
    maxLiveOrderAmount: String(settings.maxLiveOrderAmount),
    maxDailyLiveAmount: String(settings.maxDailyLiveAmount),
    maxMonthlyLiveAmount: String(settings.maxMonthlyLiveAmount),
    minCashReserve: String(settings.minCashReserve),
    maxCryptoPct: String(settings.maxCryptoPct),
    maxDailyLossPct: String(settings.maxDailyLossPct),
    maxMonthlyLossPct: String(settings.maxMonthlyLossPct),
    maxExperimentalPct: String(settings.maxExperimentalPct),
    maxDrawdownPct: String(settings.maxDrawdownPct),
    tradingWindowEnabled: settings.tradingWindowEnabled,
    tradingStartHour: String(settings.tradingStartHour),
    tradingEndHour: String(settings.tradingEndHour),
    tradingTimezone: settings.tradingTimezone,
    executionMode: settings.executionMode,
  });

  async function refreshBrokerSnapshot() {
    try {
      const res = await fetch("/api/broker/snapshot");
      const data = await res.json();
      if (res.ok) setBrokerSnapshot(data.snapshot);
    } catch {
      setBrokerSnapshot(null);
    }
  }

  async function syncBrokerSnapshot(mode: "PAPER" | "LIVE") {
    setBrokerSyncing(true);
    try {
      const res = await apiFetch("/api/broker/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Sync fallita");
      setBrokerSnapshot(data.snapshot);
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Errore sync broker");
    } finally {
      setBrokerSyncing(false);
    }
  }

  async function refreshLiveChecklist() {
    try {
      const res = await fetch("/api/live/checklist");
      const data = await res.json();
      if (res.ok) setLiveChecklist(data);
    } catch {
      setLiveChecklist(null);
    }
  }

  useEffect(() => {
    refreshLiveChecklist();
    refreshBrokerSnapshot();
  }, [settings.killSwitchActive, settings.executionMode]);

  async function saveSettings(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await apiFetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          maxPositionPct: parseFloat(form.maxPositionPct),
          maxBucketPct: parseFloat(form.maxBucketPct),
          maxDailyOrders: parseInt(form.maxDailyOrders, 10),
          maxOrderAmount: parseFloat(form.maxOrderAmount),
          maxLiveOrderAmount: parseFloat(form.maxLiveOrderAmount),
          maxDailyLiveAmount: parseFloat(form.maxDailyLiveAmount),
          maxMonthlyLiveAmount: parseFloat(form.maxMonthlyLiveAmount),
          minCashReserve: parseFloat(form.minCashReserve),
          maxCryptoPct: parseFloat(form.maxCryptoPct),
          maxDailyLossPct: parseFloat(form.maxDailyLossPct),
          maxMonthlyLossPct: parseFloat(form.maxMonthlyLossPct),
          maxExperimentalPct: parseFloat(form.maxExperimentalPct),
          maxDrawdownPct: parseFloat(form.maxDrawdownPct),
          tradingWindowEnabled: form.tradingWindowEnabled,
          tradingStartHour: parseInt(form.tradingStartHour, 10),
          tradingEndHour: parseInt(form.tradingEndHour, 10),
          tradingTimezone: form.tradingTimezone,
          executionMode: form.executionMode,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSettings(data.settings);
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Errore");
    } finally {
      setLoading(false);
    }
  }

  async function toggleKillSwitch() {
    setLoading(true);
    try {
      const res = await apiFetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ killSwitchActive: !settings.killSwitchActive }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSettings(data.settings);
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Errore");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">Impostazioni</h2>
        <p className="text-sm text-slate-400">Regole di rischio e controlli di sicurezza</p>
      </div>

      <Card>
        <CardTitle>Stato esecuzione</CardTitle>
        <div className="mt-3 flex flex-wrap gap-3">
          <Badge variant="muted">Mode: {settings.executionMode}</Badge>
          <Badge variant={liveTradingEnabled ? "warning" : "success"}>
            Live trading env: {liveTradingEnabled ? "ABILITATO" : "DISABILITATO"}
          </Badge>
          <Badge variant={settings.killSwitchActive ? "danger" : "success"}>
            Kill switch: {settings.killSwitchActive ? "ON" : "OFF"}
          </Badge>
        </div>
        <Button
          className="mt-4"
          variant={settings.killSwitchActive ? "primary" : "danger"}
          onClick={toggleKillSwitch}
          disabled={loading}
        >
          {settings.killSwitchActive ? "Disattiva kill switch" : "Attiva kill switch"}
        </Button>
      </Card>

      <Card>
        <CardTitle>Capitale</CardTitle>
        <div className="mt-3 grid gap-2 text-sm text-slate-400 sm:grid-cols-2">
          <p>
            Capitale ipotetico:{" "}
            <span className="text-white">
              {formatCurrency(settings.hypotheticalCapital)}
            </span>
          </p>
          <p>
            Liquidità:{" "}
            <span className="text-white">{formatCurrency(settings.cashBalance)}</span>
          </p>
        </div>
      </Card>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle>Snapshot conto broker (Alpaca)</CardTitle>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => syncBrokerSnapshot("PAPER")}
              disabled={brokerSyncing || loading}
            >
              Sync paper
            </Button>
            {liveTradingEnabled && (
              <Button
                type="button"
                variant="secondary"
                onClick={() => syncBrokerSnapshot("LIVE")}
                disabled={brokerSyncing || loading}
              >
                Sync live
              </Button>
            )}
          </div>
        </div>
        <p className="mt-2 text-sm text-slate-400">
          Saldo Alpaca in {brokerSnapshot?.currency ?? "USD"} — separato dal
          patrimonio ipotetico locale in EUR.
        </p>
        {brokerSnapshot ? (
          <div className="mt-3 grid gap-2 text-sm text-slate-400 sm:grid-cols-3">
            <p>
              Equity:{" "}
              <span className="text-white">
                {brokerSnapshot.equity.toFixed(2)} {brokerSnapshot.currency}
              </span>
            </p>
            <p>
              Cash:{" "}
              <span className="text-white">
                {brokerSnapshot.cash.toFixed(2)} {brokerSnapshot.currency}
              </span>
            </p>
            <p>
              Aggiornato:{" "}
              <span className="text-white">
                {new Date(brokerSnapshot.capturedAt).toLocaleString("it-IT")}
              </span>
            </p>
          </div>
        ) : (
          <p className="mt-2 text-sm text-slate-500">
            Nessuno snapshot — configura Alpaca e premi Sync.
          </p>
        )}
      </Card>

      <form onSubmit={saveSettings} className="space-y-4">
        <Card>
          <CardTitle>Regole di rischio</CardTitle>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Max posizione (%)</Label>
              <Input
                type="number"
                value={form.maxPositionPct}
                onChange={(e) =>
                  setForm({ ...form, maxPositionPct: e.target.value })
                }
              />
            </div>
            <div>
              <Label>Max bucket (%)</Label>
              <Input
                type="number"
                value={form.maxBucketPct}
                onChange={(e) => setForm({ ...form, maxBucketPct: e.target.value })}
              />
            </div>
            <div>
              <Label>Riserva liquidità minima (€)</Label>
              <Input
                type="number"
                value={form.minCashReserve}
                onChange={(e) =>
                  setForm({ ...form, minCashReserve: e.target.value })
                }
              />
            </div>
            <div>
              <Label>Max allocazione crypto (%)</Label>
              <Input
                type="number"
                value={form.maxCryptoPct}
                onChange={(e) =>
                  setForm({ ...form, maxCryptoPct: e.target.value })
                }
              />
            </div>
            <div>
              <Label>Max allocazione experimental (%)</Label>
              <Input
                type="number"
                value={form.maxExperimentalPct}
                onChange={(e) =>
                  setForm({ ...form, maxExperimentalPct: e.target.value })
                }
              />
            </div>
            <div>
              <Label>Max ordini giornalieri</Label>
              <Input
                type="number"
                value={form.maxDailyOrders}
                onChange={(e) =>
                  setForm({ ...form, maxDailyOrders: e.target.value })
                }
              />
            </div>
            <div>
              <Label>Max importo ordine (€)</Label>
              <Input
                type="number"
                value={form.maxOrderAmount}
                onChange={(e) =>
                  setForm({ ...form, maxOrderAmount: e.target.value })
                }
              />
            </div>
            <div>
              <Label>Max importo ordine LIVE (€)</Label>
              <Input
                type="number"
                value={form.maxLiveOrderAmount}
                onChange={(e) =>
                  setForm({ ...form, maxLiveOrderAmount: e.target.value })
                }
              />
            </div>
            <div>
              <Label>Max volume LIVE giornaliero (€)</Label>
              <Input
                type="number"
                value={form.maxDailyLiveAmount}
                onChange={(e) =>
                  setForm({ ...form, maxDailyLiveAmount: e.target.value })
                }
              />
            </div>
            <div>
              <Label>Max volume LIVE mensile (€)</Label>
              <Input
                type="number"
                value={form.maxMonthlyLiveAmount}
                onChange={(e) =>
                  setForm({ ...form, maxMonthlyLiveAmount: e.target.value })
                }
              />
            </div>
            <div>
              <Label>Execution mode</Label>
              <Select
                value={form.executionMode}
                onChange={(e) =>
                  setForm({ ...form, executionMode: e.target.value })
                }
              >
                <option value="MOCK">MOCK</option>
                <option value="PAPER">PAPER</option>
                {liveTradingEnabled && <option value="LIVE">LIVE</option>}
              </Select>
              {!liveTradingEnabled && (
                <p className="mt-1 text-xs text-slate-500">
                  LIVE disponibile solo con ENABLE_LIVE_TRADING=true
                </p>
              )}
              {form.executionMode === "LIVE" && (
                <p className="mt-2 text-xs text-amber-400">
                  Modalità LIVE attiva: ogni ordine richiede passphrase server,
                  strategia PROMOTED e checklist broker completa. Il kill switch
                  blocca immediatamente qualsiasi esecuzione LIVE.
                </p>
              )}
            </div>
          </div>
        </Card>

        <Card>
          <CardTitle>Limiti perdita e orari</CardTitle>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Max perdita giornaliera (%)</Label>
              <Input
                type="number"
                step="0.1"
                value={form.maxDailyLossPct}
                onChange={(e) =>
                  setForm({ ...form, maxDailyLossPct: e.target.value })
                }
              />
            </div>
            <div>
              <Label>Max perdita mensile (%)</Label>
              <Input
                type="number"
                step="0.1"
                value={form.maxMonthlyLossPct}
                onChange={(e) =>
                  setForm({ ...form, maxMonthlyLossPct: e.target.value })
                }
              />
            </div>
            <div>
              <Label>Max drawdown (%)</Label>
              <Input
                type="number"
                step="0.1"
                value={form.maxDrawdownPct}
                onChange={(e) =>
                  setForm({ ...form, maxDrawdownPct: e.target.value })
                }
              />
            </div>
            <div className="flex items-end gap-2 sm:col-span-2">
              <input
                id="tradingWindowEnabled"
                type="checkbox"
                checked={form.tradingWindowEnabled}
                onChange={(e) =>
                  setForm({ ...form, tradingWindowEnabled: e.target.checked })
                }
                className="h-4 w-4 rounded border-slate-600"
              />
              <Label htmlFor="tradingWindowEnabled">
                Abilita blocco orario trading
              </Label>
            </div>
            <div>
              <Label>Ora inizio (0–23)</Label>
              <Input
                type="number"
                min={0}
                max={23}
                value={form.tradingStartHour}
                onChange={(e) =>
                  setForm({ ...form, tradingStartHour: e.target.value })
                }
              />
            </div>
            <div>
              <Label>Ora fine (1–24)</Label>
              <Input
                type="number"
                min={1}
                max={24}
                value={form.tradingEndHour}
                onChange={(e) =>
                  setForm({ ...form, tradingEndHour: e.target.value })
                }
              />
            </div>
            <div>
              <Label>Timezone</Label>
              <Select
                value={form.tradingTimezone}
                onChange={(e) =>
                  setForm({ ...form, tradingTimezone: e.target.value })
                }
              >
                <option value="Europe/Rome">Europe/Rome</option>
                <option value="UTC">UTC</option>
              </Select>
            </div>
          </div>
          <Button className="mt-4" type="submit" disabled={loading}>
            Salva impostazioni
          </Button>
        </Card>

        <Card>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle>Checklist broker LIVE</CardTitle>
            <Button
              type="button"
              variant="secondary"
              onClick={refreshLiveChecklist}
              disabled={loading}
            >
              Aggiorna
            </Button>
          </div>
          <p className="mt-2 text-sm text-slate-400">
            Stato read-only dei prerequisiti per ordini LIVE (nessun secret
            esposto).
          </p>
          {liveChecklist ? (
            <ul className="mt-4 space-y-2 text-sm">
              {liveChecklist.items.map((item) => (
                <li
                  key={item.id}
                  className={`rounded-lg p-2 ${
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
                    <p className="mt-0.5 text-xs opacity-80">{item.detail}</p>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-slate-500">Caricamento…</p>
          )}
        </Card>
      </form>
    </div>
  );
}
