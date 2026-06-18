"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PriceStatusBadge } from "@/components/prices/PriceStatusBadge";
import { RefreshPricesButton } from "@/components/prices/RefreshPricesButton";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { bucketLabel, formatCurrency, formatPct } from "@/lib/utils";
import { apiFetch } from "@/lib/client/apiFetch";

interface PositionRow {
  id: string;
  quantity: number;
  avgPrice: number;
  bucket: string;
  notes: string | null;
  asset: { symbol: string; name: string };
  marketPrice: number;
  priceStatus: string;
  currentValue: number;
  unrealizedPnl: number;
  weightPct?: number;
}

export function PortfolioClient({
  initialPositions,
  realizedPnlTotal = 0,
}: {
  initialPositions: PositionRow[];
  realizedPnlTotal?: number;
}) {
  const router = useRouter();
  const [positions, setPositions] = useState(initialPositions);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [csvText, setCsvText] = useState("");
  const [importPreview, setImportPreview] = useState<{
    rows: Array<{ symbol: string; quantity: number; avgPrice: number }>;
    errors: Array<{ line: number; message: string }>;
  } | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [form, setForm] = useState({
    symbol: "",
    name: "",
    assetType: "ETF",
    bucket: "CORE",
    quantity: "",
    avgPrice: "",
    notes: "",
  });

  function resetForm() {
    setForm({
      symbol: "",
      name: "",
      assetType: "ETF",
      bucket: "CORE",
      quantity: "",
      avgPrice: "",
      notes: "",
    });
    setEditingId(null);
    setShowForm(false);
  }

  function startEdit(position: PositionRow) {
    setEditingId(position.id);
    setForm({
      symbol: position.asset.symbol,
      name: position.asset.name,
      assetType: "ETF",
      bucket: position.bucket,
      quantity: String(position.quantity),
      avgPrice: String(position.avgPrice),
      notes: position.notes ?? "",
    });
    setShowForm(true);
  }

  async function handleCsvPreview() {
    setLoading(true);
    try {
      const res = await apiFetch("/api/portfolio/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "preview", csv: csvText }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(JSON.stringify(data.error));
      setImportPreview(data);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Errore preview CSV");
    } finally {
      setLoading(false);
    }
  }

  async function handleCsvCommit() {
    if (!importPreview?.rows.length) return;
    setLoading(true);
    try {
      const res = await apiFetch("/api/portfolio/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "commit", rows: importPreview.rows }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(JSON.stringify(data.error));
      alert(`Importate ${data.imported} posizioni.`);
      setShowImport(false);
      setCsvText("");
      setImportPreview(null);
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Errore import");
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      if (editingId) {
        const res = await apiFetch(`/api/portfolio/${editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            quantity: parseFloat(form.quantity),
            avgPrice: parseFloat(form.avgPrice),
            bucket: form.bucket,
            notes: form.notes || undefined,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        setPositions((prev) =>
          prev.map((p) => (p.id === editingId ? data.position : p)),
        );
      } else {
        const res = await apiFetch("/api/portfolio", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            symbol: form.symbol,
            name: form.name,
            assetType: form.assetType,
            bucket: form.bucket,
            quantity: parseFloat(form.quantity),
            avgPrice: parseFloat(form.avgPrice),
            notes: form.notes || undefined,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        setPositions((prev) => [data.position, ...prev]);
      }
      resetForm();
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Errore");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Eliminare questa posizione?")) return;
    setLoading(true);
    try {
      const res = await apiFetch(`/api/portfolio/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Errore eliminazione");
      setPositions((prev) => prev.filter((p) => p.id !== id));
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Errore");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">Portfolio</h2>
          <p className="text-sm text-slate-400">
            Gestione posizioni · PnL realizzato cumulato:{" "}
            <span
              className={
                realizedPnlTotal >= 0 ? "text-green-400" : "text-red-400"
              }
            >
              {formatCurrency(realizedPnlTotal)}
            </span>
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <RefreshPricesButton />
          <Button variant="secondary" onClick={() => setShowImport(!showImport)}>
            {showImport ? "Chiudi import" : "Import CSV"}
          </Button>
          <Button onClick={() => setShowForm(!showForm)}>
            {showForm ? "Annulla" : "Aggiungi posizione"}
          </Button>
        </div>
      </div>

      {showImport && (
        <div className="space-y-3 rounded-xl border border-[var(--card-border)] bg-[var(--card)] p-5">
          <h3 className="font-semibold text-white">Import CSV broker</h3>
          <p className="text-sm text-slate-400">
            Colonne: symbol, quantity, avgPrice (opzionali: name, bucket, assetType)
          </p>
          <Textarea
            value={csvText}
            onChange={(e) => setCsvText(e.target.value)}
            rows={6}
            placeholder="symbol,quantity,avgPrice,name,bucket&#10;SWDA,10,75.5,iShares Core,CORE"
          />
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={handleCsvPreview} disabled={loading}>
              Anteprima
            </Button>
            {importPreview && importPreview.rows.length > 0 && (
              <Button type="button" onClick={handleCsvCommit} disabled={loading}>
                Conferma import ({importPreview.rows.length})
              </Button>
            )}
          </div>
          {importPreview?.errors.length ? (
            <ul className="text-sm text-red-400">
              {importPreview.errors.map((e) => (
                <li key={`${e.line}-${e.message}`}>
                  Riga {e.line}: {e.message}
                </li>
              ))}
            </ul>
          ) : null}
          {importPreview?.rows.length ? (
            <p className="text-sm text-green-400">
              {importPreview.rows.length} righe valide pronte per import.
            </p>
          ) : null}
        </div>
      )}

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-xl border border-[var(--card-border)] bg-[var(--card)] p-5"
        >
          <h3 className="font-semibold text-white">
            {editingId ? "Modifica posizione" : "Nuova posizione"}
          </h3>
          <div className="grid gap-4 sm:grid-cols-2">
            {!editingId && (
              <>
                <div>
                  <Label>Simbolo</Label>
                  <Input
                    value={form.symbol}
                    onChange={(e) => setForm({ ...form, symbol: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label>Nome</Label>
                  <Input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    required
                  />
                </div>
              </>
            )}
            <div>
              <Label>Quantità</Label>
              <Input
                type="number"
                step="any"
                value={form.quantity}
                onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                required
              />
            </div>
            <div>
              <Label>Prezzo medio</Label>
              <Input
                type="number"
                step="any"
                value={form.avgPrice}
                onChange={(e) => setForm({ ...form, avgPrice: e.target.value })}
                required
              />
            </div>
            <div>
              <Label>Bucket</Label>
              <Select
                value={form.bucket}
                onChange={(e) => setForm({ ...form, bucket: e.target.value })}
              >
                {["CORE", "GROWTH", "SPECULATIVE", "HEDGE"].map((b) => (
                  <option key={b} value={b}>
                    {bucketLabel(b)}
                  </option>
                ))}
              </Select>
            </div>
            <div className="sm:col-span-2">
              <Label>Note</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>
          </div>
          <Button type="submit" disabled={loading}>
            {loading ? "Salvataggio..." : "Salva"}
          </Button>
        </form>
      )}

      <div className="overflow-x-auto rounded-xl border border-[var(--card-border)]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700 bg-slate-900/50 text-left text-slate-500">
              <th className="p-3">Asset</th>
              <th className="p-3">Bucket</th>
              <th className="p-3">Qty</th>
              <th className="p-3">Prezzo medio</th>
              <th className="p-3">Prezzo mercato</th>
              <th className="p-3">Status</th>
              <th className="p-3">Valore</th>
              <th className="p-3">Peso %</th>
              <th className="p-3">PnL non real.</th>
              <th className="p-3">Azioni</th>
            </tr>
          </thead>
          <tbody>
            {positions.map((p) => (
              <tr key={p.id} className="border-b border-slate-800">
                <td className="p-3">
                  <div className="font-medium text-white">{p.asset.symbol}</div>
                  <div className="text-xs text-slate-500">{p.asset.name}</div>
                </td>
                <td className="p-3 text-slate-300">{bucketLabel(p.bucket)}</td>
                <td className="p-3 text-slate-300">{p.quantity}</td>
                <td className="p-3 text-slate-300">{formatCurrency(p.avgPrice)}</td>
                <td className="p-3 text-slate-300">
                  {formatCurrency(p.marketPrice)}
                </td>
                <td className="p-3">
                  <PriceStatusBadge status={p.priceStatus} />
                </td>
                <td className="p-3 text-slate-300">
                  {formatCurrency(p.currentValue)}
                </td>
                <td className="p-3 text-slate-300">
                  {formatPct(p.weightPct ?? 0)}
                </td>
                <td
                  className={`p-3 ${p.unrealizedPnl >= 0 ? "text-green-400" : "text-red-400"}`}
                >
                  {formatCurrency(p.unrealizedPnl)}
                </td>
                <td className="p-3">
                  <div className="flex gap-2">
                    <Button variant="ghost" onClick={() => startEdit(p)}>
                      Modifica
                    </Button>
                    <Button variant="danger" onClick={() => handleDelete(p.id)}>
                      Elimina
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {positions.length === 0 && (
              <tr>
                <td colSpan={10} className="p-8 text-center text-slate-500">
                  Nessuna posizione. Aggiungi la prima.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
