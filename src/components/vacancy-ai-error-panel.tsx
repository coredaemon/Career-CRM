"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui";

export function VacancyAiErrorPanel({
  vacancyId,
  errorCode,
  errorMessage,
  technicalDetails
}: {
  vacancyId: string;
  errorCode?: string | null;
  errorMessage?: string | null;
  technicalDetails?: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  if (errorCode !== "INVALID_AI_JSON" && !errorMessage) return null;

  async function retry() {
    setBusy(true);
    setMessage("");
    const response = await fetch(`/api/vacancies/${vacancyId}/analyze`, { method: "POST" });
    const data = await response.json();
    setBusy(false);
    setMessage(response.ok ? "AI-анализ повторно завершён." : data.message || "Не удалось повторить анализ.");
    if (response.ok) router.refresh();
  }

  return (
    <div className="rounded-md border border-amber-300 bg-amber-50 p-4 text-sm dark:border-amber-700 dark:bg-amber-950/30">
      <h3 className="font-semibold">AI не смог вернуть корректный анализ</h3>
      <p className="mt-2 leading-6 text-[var(--muted)]">
        {errorMessage || "Модель аналитика ответила не в том формате. Вакансия сохранена, но анализ не выполнен."}
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button onClick={retry} disabled={busy}>
          {busy ? "Повторяем..." : "Повторить AI-анализ"}
        </Button>
        <Link href="/settings/ai" className="rounded-md border border-[var(--line)] px-4 py-2 text-sm hover:bg-[var(--soft)]">
          Настройки AI
        </Link>
        <Link href="/vacancies?status=needs_review" className="rounded-md border border-[var(--line)] px-4 py-2 text-sm hover:bg-[var(--soft)]">
          Оставить на ручную проверку
        </Link>
      </div>
      {technicalDetails ? (
        <details className="mt-4">
          <summary className="cursor-pointer text-xs font-medium">Технические детали</summary>
          <pre className="mt-2 overflow-auto rounded-md bg-black/5 p-3 text-xs dark:bg-white/5">{technicalDetails}</pre>
        </details>
      ) : null}
      {message ? <p className="mt-3 text-xs text-[var(--muted)]">{message}</p> : null}
    </div>
  );
}
