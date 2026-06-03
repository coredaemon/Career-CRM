"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui";

export function InvalidVacancyPanel({
  vacancyId,
  sourceUrl,
  reason
}: {
  vacancyId: string;
  sourceUrl?: string | null;
  reason?: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function setStatus(status: string) {
    setBusy(true);
    setMessage("");
    const response = await fetch(`/api/vacancies/${vacancyId}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status })
    });
    const data = await response.json();
    setBusy(false);
    setMessage(response.ok ? "Статус обновлён." : data.message);
    if (response.ok) router.refresh();
  }

  async function markAsJunk() {
    setBusy(true);
    const response = await fetch("/api/vacancies/mark-junk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "mark", vacancyIds: [vacancyId] })
    });
    const data = await response.json();
    setBusy(false);
    setMessage(response.ok ? "Запись помечена как невалидная." : data.message);
    if (response.ok) router.refresh();
  }

  return (
    <div className="rounded-md border border-red-300 bg-red-50 p-4 text-sm dark:border-red-800 dark:bg-red-950/30">
      <h3 className="font-semibold">Это не похоже на вакансию</h3>
      <p className="mt-2 leading-6 text-[var(--muted)]">
        {reason || "CareerOS определил, что источник не является карточкой вакансии hh. AI-анализ для таких записей не запускается."}
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {sourceUrl ? (
          <a href={sourceUrl} target="_blank" rel="noreferrer" className="rounded-md border border-[var(--line)] px-4 py-2 text-sm hover:bg-[var(--soft)]">
            Открыть источник
          </a>
        ) : null}
        <Button variant="secondary" onClick={() => setStatus("needs_review")} disabled={busy}>
          Пометить как вакансию вручную
        </Button>
        <Button variant="secondary" onClick={() => setStatus("archived")} disabled={busy}>
          В архив
        </Button>
        <Button variant="secondary" onClick={markAsJunk} disabled={busy}>
          Скрыть / пометить как мусор
        </Button>
      </div>
      {message ? <p className="mt-3 text-xs text-[var(--muted)]">{message}</p> : null}
    </div>
  );
}
