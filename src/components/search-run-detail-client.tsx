"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useProcessPolling } from "@/hooks/use-process-polling";
import { formatDuration, searchRunStatusLabel, searchStageLabel } from "@/lib/process-status";
import { searchRunItemStatusLabel } from "@/lib/search-run-stats";
import { vacancyStatusLabel } from "@/lib/vacancy-status";
import { Button, Card } from "@/components/ui";
import { BulkAiAnalyzeButton } from "@/components/bulk-ai-analyze-button";

type RunItem = {
  id: string;
  status: string;
  errorCode?: string | null;
  errorMessage?: string | null;
  sourceUrl: string;
  vacancy?: {
    id: string;
    title: string;
    status: string;
    companyName?: string | null;
  } | null;
};

type InitialRun = {
  id: string;
  status: string;
  stage?: string | null;
  startedAt: string;
  finishedAt?: string | null;
  updatedAt: string;
  currentQuery?: string | null;
  currentQueryIndex?: number | null;
  totalQueries?: number | null;
  profileTitle: string;
  totalFound: number;
  totalCreated: number;
  totalDuplicates: number;
  totalAnalyzed: number;
  totalErrors: number;
  totalRecommended: number;
  totalAnalysisErrors: number;
  totalCoverLetters: number;
  queries: string[];
  logs: string[];
  errors: string[];
  progress: Record<string, number>;
  items: RunItem[];
};

type StatusResponse = {
  ok: boolean;
  run: InitialRun & { statusLabel?: string; stageLabel?: string };
  progress: Record<string, number>;
  logs: string[];
  isActive: boolean;
  isStale: boolean;
};

const tabs = ["log", "vacancies", "ai", "errors", "results"] as const;

export function SearchRunDetailClient({ initial }: { initial: InitialRun }) {
  const router = useRouter();
  const [tab, setTab] = useState<(typeof tabs)[number]>("log");
  const [recalcBusy, setRecalcBusy] = useState(false);

  const { data } = useProcessPolling<StatusResponse>(`/api/search/runs/${initial.id}/status`, {
    enabled: initial.status === "running" || initial.status === "queued"
  });

  const run = useMemo(() => {
    if (!data?.run) return initial;
    return {
      ...initial,
      ...data.run,
      status: data.run.status || initial.status,
      progress: data.progress || initial.progress,
      logs: data.logs?.length ? data.logs : initial.logs
    };
  }, [data, initial]);

  const progress = data?.progress || run.progress;
  const logs = data?.logs || run.logs;
  const isActive = data?.isActive ?? run.status === "running";
  const isStale = data?.isStale ?? run.status === "stale";

  async function markStopped() {
    await fetch(`/api/search/runs/${run.id}/mark-stopped`, { method: "POST" });
    router.refresh();
  }

  async function recalculate() {
    setRecalcBusy(true);
    await fetch(`/api/search/runs/${run.id}/recalculate-stats`, { method: "POST" });
    setRecalcBusy(false);
    router.refresh();
  }

  const startedAt = new Date(run.startedAt);
  const finishedAt = run.finishedAt ? new Date(run.finishedAt) : null;

  return (
    <div className="grid gap-6">
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold tracking-normal">{run.profileTitle}</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              {searchRunStatusLabel(run.status, new Date(run.updatedAt))} · {searchStageLabel(run.stage)} ·{" "}
              {startedAt.toLocaleString("ru-RU")}
              {finishedAt ? ` → ${finishedAt.toLocaleString("ru-RU")} (${formatDuration(startedAt, finishedAt)})` : ""}
            </p>
            {run.currentQuery ? (
              <p className="mt-1 text-sm text-[var(--muted)]">
                Запрос {run.currentQueryIndex || "?"} из {run.totalQueries || "?"}: {run.currentQuery}
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={recalculate} disabled={recalcBusy}>
              Пересчитать статистику
            </Button>
            {(isActive || isStale) && (
              <Button variant="secondary" onClick={markStopped}>
                Пометить как остановленный
              </Button>
            )}
          </div>
        </div>
        {isStale ? (
          <p className="mt-3 text-sm text-amber-700">Завис / не обновлялся длительное время. Процесс, вероятно, уже не выполняется.</p>
        ) : null}
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Metric label="Найдено" value={run.totalFound} />
          <Metric label="Валидных" value={progress.validVacancies ?? run.totalCreated} />
          <Metric label="Новых" value={run.totalCreated} />
          <Metric label="Дублей" value={run.totalDuplicates} />
          <Metric label="Пропущено URL" value={progress.skippedNotVacancy ?? 0} />
          <Metric label="Плохое описание" value={progress.skippedInvalidDescription ?? 0} />
          <Metric label="Отправлено в AI" value={progress.sentToAi ?? run.totalAnalyzed} />
          <Metric label="AI завершено" value={run.totalAnalyzed} />
          <Metric label="AI ошибок" value={run.totalAnalysisErrors} />
          <Metric label="Невалидных" value={progress.invalidSource ?? 0} />
          <Metric label="Рекомендовано" value={run.totalRecommended} />
          <Metric label="Писем" value={run.totalCoverLetters} />
          <Metric label="Ошибок" value={run.totalErrors} />
        </div>
      </Card>

      <div className="flex flex-wrap gap-2">
        {tabs.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setTab(item)}
            className={`rounded-md px-3 py-2 text-sm ${tab === item ? "bg-[var(--accent)] text-white dark:text-black" : "border border-[var(--line)]"}`}
          >
            {tabLabel(item)}
          </button>
        ))}
      </div>

      {tab === "log" ? (
        <Card>
          <h3 className="font-semibold">Лог процесса</h3>
          <div className="mt-3 max-h-96 overflow-auto text-sm leading-6">
            {logs.length === 0 ? <p className="text-[var(--muted)]">Лог пуст.</p> : logs.map((line) => <div key={line}>{line}</div>)}
          </div>
        </Card>
      ) : null}

      {tab === "vacancies" ? (
        <Card>
          <h3 className="font-semibold">Найденные вакансии</h3>
          <div className="mt-4 grid gap-3">
            {run.items.map((item) => (
              <div key={item.id} className="rounded-md border border-[var(--line)] p-3 text-sm">
                {item.vacancy ? (
                  <>
                    <Link href={`/vacancies/${item.vacancy.id}`} className="font-medium hover:text-[var(--accent)]">
                      {item.vacancy.title}
                    </Link>
                    <div className="mt-1 text-xs text-[var(--muted)]">
                      {item.vacancy.companyName || "компания не указана"} · карточка: {searchRunItemStatusLabel(item.status)} · вакансия:{" "}
                      {vacancyStatusLabel(item.vacancy.status)}
                    </div>
                  </>
                ) : (
                  <div>
                    <div className="font-medium">{item.sourceUrl}</div>
                    <div className="mt-1 text-xs text-[var(--muted)]">{searchRunItemStatusLabel(item.status)}</div>
                  </div>
                )}
                {item.errorMessage ? <p className="mt-2 text-xs text-amber-700">{item.errorMessage}</p> : null}
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      {tab === "ai" ? (
        <Card className="grid gap-4">
          <h3 className="font-semibold">AI-анализ</h3>
          <p className="text-sm text-[var(--muted)]">
            Обработано: {run.totalAnalyzed} · Ошибок: {run.totalAnalysisErrors} · Рекомендовано: {run.totalRecommended} · Писем:{" "}
            {run.totalCoverLetters}
          </p>
          <div className="flex flex-wrap gap-2">
            <BulkAiAnalyzeButton label="Проанализировать непроанализированные" />
            <BulkAiAnalyzeButton label="Повторить ошибки анализа" retryErrorsOnly />
          </div>
        </Card>
      ) : null}

      {tab === "errors" ? (
        <Card>
          <h3 className="font-semibold">Ошибки</h3>
          {run.errors.length === 0 && run.items.every((i) => !i.errorMessage) ? (
            <p className="mt-3 text-sm text-[var(--muted)]">Ошибок нет.</p>
          ) : (
            <ul className="mt-3 grid gap-3 text-sm">
              {run.errors.map((error) => (
                <li key={error} className="rounded-md border border-[var(--line)] p-3">
                  <div className="font-medium">Ошибка сбора или процесса</div>
                  <p className="mt-1 text-[var(--muted)]">{error}</p>
                </li>
              ))}
              {run.items
                .filter((item) => item.errorMessage)
                .map((item) => (
                  <li key={item.id} className="rounded-md border border-[var(--line)] p-3">
                    <div className="font-medium">{item.errorCode === "INVALID_AI_JSON" ? "AI не смог вернуть корректный анализ" : "Ошибка AI-анализа"}</div>
                    <p className="mt-1 text-[var(--muted)]">{item.errorMessage}</p>
                    <details className="mt-2">
                      <summary className="cursor-pointer text-xs">Технические детали</summary>
                      <p className="mt-1 text-xs text-[var(--muted)]">Код: {item.errorCode || "—"}</p>
                    </details>
                  </li>
                ))}
            </ul>
          )}
        </Card>
      ) : null}

      {tab === "results" ? (
        <Card>
          <h3 className="font-semibold">{run.status === "completed" ? "Поиск завершён" : "Результаты"}</h3>
          <div className="mt-3 grid gap-2 text-sm text-[var(--muted)]">
            <p>Собрано вакансий: {run.totalFound}</p>
            <p>Новых: {run.totalCreated}</p>
            <p>Дублей: {run.totalDuplicates}</p>
            <p>AI проанализировал: {run.totalAnalyzed}</p>
            <p>Пропущено служебных URL: {progress.skippedNotVacancy ?? 0}</p>
            <p>Пропущено из-за описания: {progress.skippedInvalidDescription ?? 0}</p>
            <p>Невалидных источников: {progress.invalidSource ?? 0}</p>
            <p>Ошибок анализа: {run.totalAnalysisErrors}</p>
            <p>Рекомендовано: {run.totalRecommended}</p>
            <p>Готово к отклику (с письмами): {progress.readyToApply ?? run.totalCoverLetters}</p>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link href="/vacancies/recommended" className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm text-white dark:text-black">
              Открыть рекомендованные
            </Link>
            <Link href="/vacancies?status=ready_to_apply" className="rounded-md border border-[var(--line)] px-4 py-2 text-sm">
              Готовые к отклику
            </Link>
            <Link href="/vacancies?status=analysis_error" className="rounded-md border border-[var(--line)] px-4 py-2 text-sm">
              Повторить ошибки AI
            </Link>
            <Link href="/vacancies?status=no_ai" className="rounded-md border border-[var(--line)] px-4 py-2 text-sm">
              Проанализировать оставшиеся
            </Link>
            <Link href="/vacancies" className="rounded-md border border-[var(--line)] px-4 py-2 text-sm">
              Все найденные
            </Link>
          </div>
        </Card>
      ) : null}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-[var(--line)] p-3">
      <div className="text-xs text-[var(--muted)]">{label}</div>
      <div className="mt-2 text-2xl font-semibold">{value}</div>
    </div>
  );
}

function tabLabel(tab: (typeof tabs)[number]) {
  const labels: Record<(typeof tabs)[number], string> = {
    log: "Лог",
    vacancies: "Найденные вакансии",
    ai: "AI-анализ",
    errors: "Ошибки",
    results: "Результаты"
  };
  return labels[tab];
}
