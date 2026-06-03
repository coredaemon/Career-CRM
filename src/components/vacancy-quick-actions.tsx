"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { CreateCoverLetterButton } from "@/components/create-cover-letter-button";
import { CopyButton } from "@/components/copy-button";
import { Button } from "@/components/ui";

const APPLIED_STATUSES = new Set(["applied", "waiting_response", "no_response"]);
const READY_STATUSES = new Set(["ready_to_apply", "ai_recommended"]);

type ConfirmState = "idle" | "confirm_with_letter" | "confirm_no_letter";

export function VacancyQuickActions({
  vacancyId,
  status,
  sourceUrl,
  hasCoverLetter = false,
  hasAiAnalysis = false,
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
  const [confirm, setConfirm] = useState<ConfirmState>("idle");

  async function run(action: "applied" | "skipped" | "archived" | "check_later") {
    setBusy(action);
    setToast("");
    setConfirm("idle");
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

  function handleApplyClick() {
    if (hasCoverLetter) {
      setConfirm("confirm_with_letter");
    } else {
      setConfirm("confirm_no_letter");
    }
  }

  const openLink = showOpenLink ? (
    <Link href={`/vacancies/${vacancyId}`} className="rounded-md border border-[var(--line)] px-4 py-2 text-sm hover:bg-[var(--soft)]">
      Открыть
    </Link>
  ) : null;

  const sourceLink = sourceUrl ? (
    <a href={sourceUrl} target="_blank" rel="noreferrer" className="rounded-md border border-[var(--line)] px-4 py-2 text-sm hover:bg-[var(--soft)]">
      Открыть на hh
    </a>
  ) : null;

  if (hideApply || status === "invalid_source" || status === "skipped_invalid") {
    return (
      <div className="flex flex-wrap gap-2">
        {openLink}
        {sourceLink}
        <Button variant="secondary" onClick={() => run("archived")} disabled={Boolean(busy)}>
          В архив
        </Button>
      </div>
    );
  }

  if (APPLIED_STATUSES.has(status)) {
    return (
      <div className="grid gap-2">
        <div className="flex flex-wrap gap-2">
          {openLink}
          {sourceLink}
          <Button variant="secondary" onClick={() => run("archived")} disabled={Boolean(busy)}>
            В архив
          </Button>
        </div>
        {toast ? <p className="text-sm text-green-700 dark:text-green-400">{toast}</p> : null}
      </div>
    );
  }

  if (!hasAiAnalysis) {
    return (
      <div className="flex flex-wrap gap-2">
        {openLink}
        {sourceLink}
      </div>
    );
  }

  const isReadyWithLetter = hasCoverLetter && READY_STATUSES.has(status);
  const isRecommendedNoLetter = !hasCoverLetter && READY_STATUSES.has(status);

  if (isReadyWithLetter) {
    return (
      <div className="grid gap-2">
        {confirm === "confirm_with_letter" ? (
          <div className="rounded-md border border-[var(--line)] bg-[var(--soft)] p-3 text-sm">
            <p className="mb-2 font-medium">Вы вручную отправили отклик на hh?</p>
            <p className="mb-3 text-[var(--muted)]">Вакансия будет помечена как «Отклик отправлен» и уйдёт из очереди откликов.</p>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => run("applied")} disabled={Boolean(busy)}>
                {busy === "applied" ? "Отмечаем..." : "Подтвердить"}
              </Button>
              <Button variant="secondary" onClick={() => setConfirm("idle")} disabled={Boolean(busy)}>
                Отмена
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {openLink}
            {sourceLink}
            {coverLetterText ? <CopyButton text={coverLetterText} label="Скопировать письмо" /> : null}
            <Button onClick={handleApplyClick} disabled={Boolean(busy)}>
              Отклик отправлен
            </Button>
            <Button variant="secondary" onClick={() => run("check_later")} disabled={Boolean(busy)}>
              Проверить позже
            </Button>
            <Button variant="secondary" onClick={() => run("skipped")} disabled={Boolean(busy)}>
              Пропустить
            </Button>
            <Button variant="secondary" onClick={() => run("archived")} disabled={Boolean(busy)}>
              В архив
            </Button>
          </div>
        )}
        {toast ? <p className="text-sm text-green-700 dark:text-green-400">{toast}</p> : null}
      </div>
    );
  }

  if (isRecommendedNoLetter) {
    return (
      <div className="grid gap-2">
        <div className="flex flex-wrap gap-2">
          {openLink}
          {sourceLink}
          <CreateCoverLetterButton vacancyId={vacancyId} resumeId={resumeId} label="Создать письмо" compact />
          <Button variant="secondary" onClick={() => run("skipped")} disabled={Boolean(busy)}>
            Пропустить
          </Button>
          <Button variant="secondary" onClick={() => run("archived")} disabled={Boolean(busy)}>
            В архив
          </Button>
        </div>
        {toast ? <p className="text-sm text-[var(--muted)]">{toast}</p> : null}
      </div>
    );
  }

  if (status === "analysis_error") {
    return (
      <div className="flex flex-wrap gap-2">
        {openLink}
        <Button variant="secondary" onClick={() => run("check_later")} disabled={Boolean(busy)}>
          Оставить на проверку
        </Button>
        <Button variant="secondary" onClick={() => run("archived")} disabled={Boolean(busy)}>
          В архив
        </Button>
      </div>
    );
  }

  if (confirm === "confirm_no_letter") {
    return (
      <div className="grid gap-2">
        <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm dark:bg-amber-950/30">
          <p className="mb-2 font-medium text-amber-900 dark:text-amber-200">Для этой вакансии нет сопроводительного письма.</p>
          <p className="mb-3 text-amber-800 dark:text-amber-300">Рекомендуем сначала создать письмо. Вы всё равно хотите отметить отклик?</p>
          <div className="flex flex-wrap gap-2">
            <CreateCoverLetterButton vacancyId={vacancyId} resumeId={resumeId} label="Создать письмо" compact />
            <Button variant="secondary" onClick={() => run("applied")} disabled={Boolean(busy)}>
              {busy === "applied" ? "Отмечаем..." : "Отметить без письма"}
            </Button>
            <Button variant="secondary" onClick={() => setConfirm("idle")} disabled={Boolean(busy)}>
              Отмена
            </Button>
          </div>
        </div>
        {toast ? <p className="text-sm text-[var(--muted)]">{toast}</p> : null}
      </div>
    );
  }

  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap gap-2">
        {openLink}
        {sourceLink}
        {hasCoverLetter && coverLetterText ? <CopyButton text={coverLetterText} label="Скопировать письмо" /> : null}
        {hasAiAnalysis ? (
          <Button variant="secondary" onClick={handleApplyClick} disabled={Boolean(busy)}>
            {busy === "applied" ? "Отмечаем..." : "Отклик отправлен"}
          </Button>
        ) : null}
        <Button variant="secondary" onClick={() => run("skipped")} disabled={Boolean(busy)}>
          Пропустить
        </Button>
        <Button variant="secondary" onClick={() => run("archived")} disabled={Boolean(busy)}>
          В архив
        </Button>
      </div>
      {toast ? <p className="text-sm text-[var(--muted)]">{toast}</p> : null}
    </div>
  );
}
