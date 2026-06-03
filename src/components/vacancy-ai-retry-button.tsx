"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";

export function VacancyAiRetryButton({ vacancyId, mode = "fast" }: { vacancyId: string; mode?: "fast" | "full" }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function analyze() {
    setBusy(true);
    setMessage("");
    const response = await fetch(`/api/vacancies/${vacancyId}/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode })
    });
    const data = await response.json();
    setBusy(false);
    setMessage(response.ok ? "AI-анализ обновлён." : data.message);
    if (response.ok) router.refresh();
  }

  return (
    <div className="grid gap-2">
      <Button variant="secondary" onClick={analyze} disabled={busy}>
        {busy ? "AI анализирует..." : mode === "fast" ? "Быстрый AI-анализ" : "Повторить AI-анализ"}
      </Button>
      {message ? <p className="text-xs text-[var(--muted)]">{message}</p> : null}
    </div>
  );
}
