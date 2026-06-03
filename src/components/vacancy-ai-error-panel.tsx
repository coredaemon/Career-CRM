"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { INVALID_AI_JSON_MESSAGE } from "@/lib/ai-errors";
import { Button } from "@/components/ui";

export function VacancyAiErrorPanel({
  vacancyId,
  errorCode,
  errorMessage,
  technicalDetails,
  looksLikeServicePage
}: {
  vacancyId: string;
  errorCode?: string | null;
  errorMessage?: string | null;
  technicalDetails?: string | null;
  looksLikeServicePage?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  if (errorCode !== "INVALID_AI_JSON" && errorCode !== "INVALID_VACANCY_SOURCE" && !errorMessage) return null;

  async function retryFast() {
    setBusy(true);
    setMessage("");
    const response = await fetch(`/api/vacancies/${vacancyId}/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "fast" })
    });
    const data = await response.json();
    setBusy(false);
    setMessage(response.ok ? "Быстрый AI-анализ повторно завершён." : data.message || "Не удалось повторить анализ.");
    if (response.ok) router.refresh();
  }

  async function markAsJunk() {
    setBusy(true);
    setMessage("");
    const response = await fetch("/api/vacancies/mark-junk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "mark", vacancyIds: [vacancyId] })
    });
    const data = await response.json();
    setBusy(false);
    setMessage(response.ok ? "Запись помечена как мусорная." : data.message || "Не удалось пометить.");
    if (response.ok) router.refresh();
  }

  const displayMessage =
    errorCode === "INVALID_AI_JSON"
      ? INVALID_AI_JSON_MESSAGE
      : errorMessage || "Модель аналитика ответила не в том формате. Вакансия сохранена, но анализ не выполнен.";

  return (
    <div className="rounded-md border border-amber-300 bg-amber-50 p-4 text-sm dark:border-amber-700 dark:bg-amber-950/30">
      <h3 className="font-semibold">AI не смог вернуть корректный анализ</h3>
      <p className="mt-2 leading-6 text-[var(--muted)]">{displayMessage}</p>
      {looksLikeServicePage ? (
        <p className="mt-2 text-sm text-amber-800 dark:text-amber-200">
          Возможная причина: описание вакансии похоже на служебную страницу hh/cookie/navigation.
        </p>
      ) : null}
      <div className="mt-4 flex flex-wrap gap-2">
        <a href="#vacancy-description" className="rounded-md border border-[var(--line)] px-4 py-2 text-sm hover:bg-[var(--soft)]">
          Проверить текст вакансии
        </a>
        <Button onClick={retryFast} disabled={busy}>
          {busy ? "Повторяем..." : "Повторить быстрый анализ"}
        </Button>
        <Link href="/vacancies?status=needs_review" className="rounded-md border border-[var(--line)] px-4 py-2 text-sm hover:bg-[var(--soft)]">
          Оставить на ручную проверку
        </Link>
        <Button variant="secondary" onClick={markAsJunk} disabled={busy}>
          Пометить как мусор
        </Button>
        <Link href="/settings/ai" className="rounded-md border border-[var(--line)] px-4 py-2 text-sm hover:bg-[var(--soft)]">
          Настройки AI
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
