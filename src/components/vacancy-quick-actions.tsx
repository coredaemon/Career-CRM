"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { CreateCoverLetterButton } from "@/components/create-cover-letter-button";
import { CopyButton } from "@/components/copy-button";
import { Button } from "@/components/ui";
import { COVER_LETTER_SCORE_THRESHOLD } from "@/lib/vacancy-application-queue";

export function VacancyQuickActions({
  vacancyId,
  status,
  sourceUrl,
  hasCoverLetter = false,
  hasAiAnalysis = false,
  matchScore = null,
  coverLetterText,
  resumeId,
  hideApply = false,
  showOpenLink = true
}: {
  vacancyId: string;
  status: string;
  sourceUrl?: string | null;
  hasCoverLetter?: boolean;
  hasAiAnalysis?: boolean;
  matchScore?: number | null;
  coverLetterText?: string | null;
  resumeId?: string | null;
  hideApply?: boolean;
  showOpenLink?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState("");

  const canApplyWithLetter = hasCoverLetter && (status === "ready_to_apply" || status === "ai_recommended");
  const needsLetter =
    hasAiAnalysis &&
    !hasCoverLetter &&
    !hideApply &&
    (status === "ai_recommended" ||
      status === "ready_to_apply" ||
      status === "needs_review" ||
      (matchScore ?? 0) >= COVER_LETTER_SCORE_THRESHOLD);
  const showApplyButton = !hideApply && (canApplyWithLetter || (!needsLetter && hasAiAnalysis && status !== "invalid_source"));

  async function run(action: "applied" | "skipped" | "archived" | "check_later") {
    if (action === "applied" && !hasCoverLetter) {
      const confirmed = window.confirm(
        "Письмо ещё не создано. Вы точно уже отправили отклик вручную?\n\nРекомендуем сначала создать сопроводительное письмо."
      );
      if (!confirmed) return;
    }

    setBusy(action);
    setToast("");
    const response = await fetch(`/api/vacancies/${vacancyId}/action`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action })
    });
    const data = await response.json();
    setBusy(null);
    if (!response.ok) {
      setToast(data.message || "Не удалось выполнить действие.");
      return;
    }
    if (action === "applied" && data.message) {
      setToast(data.message);
    }
    router.refresh();
  }

  if (hideApply) {
    return (
      <div className="flex flex-wrap gap-2">
        {showOpenLink ? (
          <Link href={`/vacancies/${vacancyId}`} className="rounded-md border border-[var(--line)] px-4 py-2 text-sm hover:bg-[var(--soft)]">
            Открыть
          </Link>
        ) : null}
        {sourceUrl ? (
          <a href={sourceUrl} target="_blank" rel="noreferrer" className="rounded-md border border-[var(--line)] px-4 py-2 text-sm hover:bg-[var(--soft)]">
            Открыть источник
          </a>
        ) : null}
        <Button variant="secondary" onClick={() => run("archived")} disabled={Boolean(busy)}>
          В архив
        </Button>
      </div>
    );
  }

  if (!hasAiAnalysis) {
    return (
      <div className="flex flex-wrap gap-2">
        {showOpenLink ? (
          <Link href={`/vacancies/${vacancyId}`} className="rounded-md border border-[var(--line)] px-4 py-2 text-sm hover:bg-[var(--soft)]">
            Открыть
          </Link>
        ) : null}
        {sourceUrl ? (
          <a href={sourceUrl} target="_blank" rel="noreferrer" className="rounded-md border border-[var(--line)] px-4 py-2 text-sm hover:bg-[var(--soft)]">
            Открыть на hh
          </a>
        ) : null}
      </div>
    );
  }

  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap gap-2">
        {showOpenLink ? (
          <Link href={`/vacancies/${vacancyId}`} className="rounded-md border border-[var(--line)] px-4 py-2 text-sm hover:bg-[var(--soft)]">
            Открыть
          </Link>
        ) : null}
        {sourceUrl ? (
          <a href={sourceUrl} target="_blank" rel="noreferrer" className="rounded-md border border-[var(--line)] px-4 py-2 text-sm hover:bg-[var(--soft)]">
            Открыть на hh
          </a>
        ) : null}
        {needsLetter ? (
          <CreateCoverLetterButton vacancyId={vacancyId} resumeId={resumeId} label="Создать письмо" compact />
        ) : null}
        {canApplyWithLetter && coverLetterText ? <CopyButton text={coverLetterText} label="Скопировать письмо" /> : null}
        {showApplyButton && canApplyWithLetter ? (
          <Button onClick={() => run("applied")} disabled={Boolean(busy)}>
            {busy === "applied" ? "Отмечаем..." : "Отклик отправлен"}
          </Button>
        ) : null}
        {!needsLetter && !canApplyWithLetter && showApplyButton ? (
          <Button onClick={() => run("applied")} disabled={Boolean(busy)} variant="secondary">
            {busy === "applied" ? "Отмечаем..." : "Отклик отправлен"}
          </Button>
        ) : null}
        {canApplyWithLetter || status === "applied" ? (
          <Button variant="secondary" onClick={() => run("check_later")} disabled={Boolean(busy)}>
            Проверить позже
          </Button>
        ) : null}
        <Button variant="secondary" onClick={() => run("skipped")} disabled={Boolean(busy)}>
          Пропустить
        </Button>
        <Button variant="secondary" onClick={() => run("archived")} disabled={Boolean(busy)}>
          В архив
        </Button>
      </div>
      {toast ? <p className="text-sm text-green-700 dark:text-green-400">{toast}</p> : null}
    </div>
  );
}
