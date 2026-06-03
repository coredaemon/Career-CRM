"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";

export function BulkAiAnalyzeButton({ label = "Проанализировать непроанализированные" }: { label?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function analyze() {
    setBusy(true);
    setMessage("");
    const response = await fetch("/api/vacancies/analyze-bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ limit: 20 })
    });
    const data = await response.json();
    setBusy(false);
    setMessage(
      response.ok
        ? `AI-анализ завершён: ${data.analyzed}, пропущено: ${data.skipped}, ошибок: ${data.errors?.length || 0}.`
        : data.message
    );
    if (response.ok) router.refresh();
  }

  return (
    <div className="grid gap-2">
      <Button onClick={analyze} disabled={busy}>
        {busy ? "AI анализирует..." : label}
      </Button>
      {message ? <p className="text-xs text-[var(--muted)]">{message}</p> : null}
    </div>
  );
}
