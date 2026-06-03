"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { INVALID_AI_JSON_MESSAGE } from "@/lib/ai-errors";
import { Button } from "@/components/ui";

type Diagnostics = {
  attempts: number;
  repairUsed: boolean;
  fallbackUsed: boolean;
  totalDurationMs: number;
  lastProvider?: string;
  lastModel?: string;
  lastErrorCode?: string | null;
  lastDurationMs?: number | null;
};

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
  const [busy, setBusy] = useState<"fast" | "openai" | "junk" | null>(null);
  const [message, setMessage] = useState("");
  const [diagnostics, setDiagnostics] = useState<Diagnostics | null>(null);

  useEffect(() => {
    if (errorCode !== "INVALID_AI_JSON") return;
    fetch(`/api/vacancies/${vacancyId}/analysis-diagnostics`)
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) setDiagnostics(data.diagnostics);
      })
      .catch(() => undefined);
  }, [vacancyId, errorCode]);

  if (errorCode !== "INVALID_AI_JSON" && errorCode !== "INVALID_VACANCY_SOURCE" && !errorMessage) return null;

  async function retry(mode: "fast" | "openai") {
    setBusy(mode);
    setMessage("");
    const response = await fetch(`/api/vacancies/${vacancyId}/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: "fast",
        ...(mode === "openai" ? { fallbackProvider: "openai" } : {})
      })
    });
    const data = await response.json();
    setBusy(null);
    if (response.ok) {
      setMessage(mode === "openai" ? "Анализ через OpenAI завершён." : "Быстрый AI-анализ повторно завершён.");
      router.refresh();
      return;
    }
    if (data.code === "OPENAI_NOT_CONFIGURED") {
      router.push("/settings/ai");
      return;
    }
    setMessage(data.message || "Не удалось повторить анализ.");
  }

  async function markAsJunk() {
    setBusy("junk");
    setMessage("");
    const response = await fetch("/api/vacancies/mark-junk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "mark", vacancyIds: [vacancyId] })
    });
    const data = await response.json();
    setBusy(null);
    setMessage(response.ok ? "Запись помечена как мусорная." : data.message || "Не удалось пометить.");
    if (response.ok) router.refresh();
  }

  const displayMessage =
    errorCode === "INVALID_AI_JSON"
      ? INVALID_AI_JSON_MESSAGE
      : errorMessage || "Модель аналитика ответила не в том формате. Вакансия сохранена, но анализ не выполнен.";

  const title =
    errorCode === "INVALID_AI_JSON"
      ? "AI не смог разобрать вакансию в структурированном формате"
      : "AI не смог вернуть корректный анализ";

  return (
    <div className="rounded-md border border-amber-300 bg-amber-50 p-4 text-sm dark:border-amber-700 dark:bg-amber-950/30">
      <h3 className="font-semibold">{title}</h3>
      <p className="mt-2 leading-6 text-[var(--muted)]">{displayMessage}</p>
      {diagnostics ? (
        <ul className="mt-3 grid gap-1 text-xs text-[var(--muted)]">
          {diagnostics.lastModel ? (
            <li>
              Модель аналитика: {diagnostics.lastProvider} / {diagnostics.lastModel}
            </li>
          ) : null}
          <li>Попыток анализа: {diagnostics.attempts}</li>
          <li>Repair: {diagnostics.repairUsed ? "да" : "нет"}</li>
          <li>Fallback OpenAI: {diagnostics.fallbackUsed ? "да" : "нет"}</li>
          {diagnostics.totalDurationMs > 0 ? (
            <li>Время AI-вызовов: {Math.round(diagnostics.totalDurationMs / 1000)} сек</li>
          ) : null}
          {diagnostics.lastErrorCode ? <li>Код ошибки: {diagnostics.lastErrorCode}</li> : null}
        </ul>
      ) : null}
      {looksLikeServicePage ? (
        <p className="mt-2 text-sm text-amber-800 dark:text-amber-200">
          Возможная причина: описание вакансии похоже на служебную страницу hh/cookie/navigation.
        </p>
      ) : null}
      <div className="mt-4 flex flex-wrap gap-2">
        <a href="#vacancy-description" className="rounded-md border border-[var(--line)] px-4 py-2 text-sm hover:bg-[var(--soft)]">
          Проверить текст вакансии
        </a>
        <Button onClick={() => retry("fast")} disabled={Boolean(busy)}>
          {busy === "fast" ? "Повторяем..." : "Повторить быстрый анализ"}
        </Button>
        <Button variant="secondary" onClick={() => retry("openai")} disabled={Boolean(busy)}>
          {busy === "openai" ? "OpenAI..." : "Повторить через OpenAI"}
        </Button>
        <Link href="/vacancies?status=needs_review" className="rounded-md border border-[var(--line)] px-4 py-2 text-sm hover:bg-[var(--soft)]">
          Оставить на ручную проверку
        </Link>
        <Button variant="secondary" onClick={markAsJunk} disabled={Boolean(busy)}>
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
