"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { apiFetch } from "@/lib/client/apiFetch";

export function RefreshPricesButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleRefresh() {
    setLoading(true);
    setMessage(null);
    try {
      const res = await apiFetch("/api/prices/refresh", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Errore refresh");
      setMessage(
        `Aggiornati ${data.refreshed} asset` +
          (data.failed > 0 ? `, ${data.failed} non disponibili` : ""),
      );
      router.refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Errore");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button variant="secondary" onClick={handleRefresh} disabled={loading}>
        {loading ? "Aggiornamento..." : "Aggiorna prezzi"}
      </Button>
      {message && <span className="text-sm text-slate-400">{message}</span>}
    </div>
  );
}
