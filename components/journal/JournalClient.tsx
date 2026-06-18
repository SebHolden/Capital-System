"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { RiskBadge } from "@/components/ui/RiskBadge";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { scoreJournal } from "@/lib/journal";
import { apiFetch } from "@/lib/client/apiFetch";
import { formatCurrency } from "@/lib/utils";

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
  qualityScore: number;
  isComplete: boolean;
  createdAt: string;
}

const defaultForm = {
  title: "",
  thesis: "",
  risks: "",
  invalidation: "",
  emotionalState: "",
  timeHorizon: "6-12 mesi",
  maxAcceptableLoss: "500",
  exitRule: "",
  emotionScore: "5",
  confidenceScore: "5",
  planned: true,
};

export function JournalClient({ initialJournals }: { initialJournals: Journal[] }) {
  const router = useRouter();
  const [journals, setJournals] = useState(initialJournals);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState(defaultForm);

  const preview = useMemo(() => {
    const emotionScore = parseInt(form.emotionScore, 10) || 5;
    const confidenceScore = parseInt(form.confidenceScore, 10) || 5;
    const maxAcceptableLoss = parseFloat(form.maxAcceptableLoss) || 0;

    if (!form.title && !form.thesis) return null;

    return scoreJournal({
      title: form.title,
      thesis: form.thesis,
      risks: form.risks,
      invalidation: form.invalidation,
      emotionalState: form.emotionalState,
      timeHorizon: form.timeHorizon,
      maxAcceptableLoss,
      exitRule: form.exitRule,
      emotionScore,
      confidenceScore,
      planned: form.planned,
    });
  }, [form]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await apiFetch("/api/journal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title,
          thesis: form.thesis,
          risks: form.risks,
          invalidation: form.invalidation,
          emotionalState: form.emotionalState,
          timeHorizon: form.timeHorizon,
          maxAcceptableLoss: parseFloat(form.maxAcceptableLoss),
          exitRule: form.exitRule,
          emotionScore: parseInt(form.emotionScore, 10),
          confidenceScore: parseInt(form.confidenceScore, 10),
          planned: form.planned,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(JSON.stringify(data.error));
      setJournals((prev) => [data.journal, ...prev]);
      setForm(defaultForm);
      setShowForm(false);
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Errore");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Journal</h2>
          <p className="text-sm text-slate-400">
            Registra la decisione prima di ogni operazione — scoring anti-impulso
          </p>
        </div>
        <Button onClick={() => setShowForm(!showForm)}>
          {showForm ? "Annulla" : "Nuovo journal"}
        </Button>
      </div>

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-xl border border-[var(--card-border)] bg-[var(--card)] p-5"
        >
          <div>
            <Label>Titolo / motivo</Label>
            <Input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              required
            />
          </div>
          <div>
            <Label>Tesi</Label>
            <Textarea
              value={form.thesis}
              onChange={(e) => setForm({ ...form, thesis: e.target.value })}
              required
              minLength={10}
            />
          </div>
          <div>
            <Label>Rischi</Label>
            <Textarea
              value={form.risks}
              onChange={(e) => setForm({ ...form, risks: e.target.value })}
              required
              minLength={10}
            />
          </div>
          <div>
            <Label>Condizioni di invalidazione</Label>
            <Textarea
              value={form.invalidation}
              onChange={(e) => setForm({ ...form, invalidation: e.target.value })}
              required
              minLength={10}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Orizzonte temporale</Label>
              <Select
                value={form.timeHorizon}
                onChange={(e) => setForm({ ...form, timeHorizon: e.target.value })}
              >
                <option value="1-3 mesi">1-3 mesi</option>
                <option value="3-6 mesi">3-6 mesi</option>
                <option value="6-12 mesi">6-12 mesi</option>
                <option value="1-2 anni">1-2 anni</option>
                <option value="2+ anni">2+ anni</option>
              </Select>
            </div>
            <div>
              <Label>Perdita massima accettabile (€)</Label>
              <Input
                type="number"
                min={1}
                step="any"
                value={form.maxAcceptableLoss}
                onChange={(e) =>
                  setForm({ ...form, maxAcceptableLoss: e.target.value })
                }
                required
              />
            </div>
          </div>
          <div>
            <Label>Regola di uscita</Label>
            <Textarea
              value={form.exitRule}
              onChange={(e) => setForm({ ...form, exitRule: e.target.value })}
              required
              minLength={5}
            />
          </div>
          <div>
            <Label>Stato emotivo (testo libero)</Label>
            <Input
              value={form.emotionalState}
              onChange={(e) =>
                setForm({ ...form, emotionalState: e.target.value })
              }
              required
              placeholder="Es. Calmo, nessuna urgenza"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Emotion score (1=calmo, 10=impulsivo): {form.emotionScore}</Label>
              <input
                type="range"
                min={1}
                max={10}
                value={form.emotionScore}
                onChange={(e) =>
                  setForm({ ...form, emotionScore: e.target.value })
                }
                className="mt-2 w-full"
              />
            </div>
            <div>
              <Label>Confidence score (1-10): {form.confidenceScore}</Label>
              <input
                type="range"
                min={1}
                max={10}
                value={form.confidenceScore}
                onChange={(e) =>
                  setForm({ ...form, confidenceScore: e.target.value })
                }
                className="mt-2 w-full"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input
              id="planned"
              type="checkbox"
              checked={form.planned}
              onChange={(e) => setForm({ ...form, planned: e.target.checked })}
              className="h-4 w-4 rounded border-slate-600"
            />
            <Label htmlFor="planned">Trade pianificato (non impulsivo)</Label>
          </div>

          {preview && (
            <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-4">
              <p className="text-sm font-medium text-slate-300">Anteprima qualità</p>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <RiskBadge level={preview.level} />
                <Badge variant="muted">Score: {preview.qualityScore}/100</Badge>
                <Badge variant={preview.isComplete ? "success" : "warning"}>
                  {preview.isComplete ? "Completo" : "Incompleto"}
                </Badge>
              </div>
              {preview.warnings.length > 0 && (
                <ul className="mt-2 list-inside list-disc text-xs text-amber-400">
                  {preview.warnings.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <Button type="submit" disabled={loading}>
            {loading ? "Salvataggio..." : "Crea journal"}
          </Button>
        </form>
      )}

      <div className="space-y-3">
        {journals.map((j) => {
          const scored = scoreJournal({
            title: j.title,
            thesis: j.thesis,
            risks: j.risks,
            invalidation: j.invalidation,
            emotionalState: j.emotionalState,
            timeHorizon: j.timeHorizon,
            maxAcceptableLoss: j.maxAcceptableLoss,
            exitRule: j.exitRule,
            emotionScore: j.emotionScore,
            confidenceScore: j.confidenceScore,
            planned: j.planned,
          });

          return (
            <div
              key={j.id}
              className="rounded-xl border border-[var(--card-border)] bg-[var(--card)] p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h3 className="font-semibold text-white">{j.title}</h3>
                  <p className="text-xs text-slate-500">
                    {new Date(j.createdAt).toLocaleString("it-IT")}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <RiskBadge level={scored.level} />
                  <Badge variant="muted">
                    Score: {j.qualityScore || scored.qualityScore}/100
                  </Badge>
                  <Badge variant={j.isComplete ? "success" : "warning"}>
                    {j.isComplete ? "Completo" : "Incompleto"}
                  </Badge>
                </div>
              </div>
              <div className="mt-3 grid gap-2 text-sm text-slate-400 sm:grid-cols-2">
                <div>
                  <span className="text-slate-500">Tesi: </span>
                  {j.thesis}
                </div>
                <div>
                  <span className="text-slate-500">Orizzonte: </span>
                  {j.timeHorizon}
                </div>
                <div>
                  <span className="text-slate-500">Max perdita: </span>
                  {formatCurrency(j.maxAcceptableLoss)}
                </div>
                <div>
                  <span className="text-slate-500">Emotion / Confidence: </span>
                  {j.emotionScore}/10 · {j.confidenceScore}/10
                </div>
                <div>
                  <span className="text-slate-500">Pianificato: </span>
                  {j.planned ? "Sì" : "No"}
                </div>
                <div>
                  <span className="text-slate-500">Uscita: </span>
                  {j.exitRule}
                </div>
              </div>
            </div>
          );
        })}
        {journals.length === 0 && (
          <p className="text-center text-slate-500">Nessun journal. Creane uno.</p>
        )}
      </div>
    </div>
  );
}
