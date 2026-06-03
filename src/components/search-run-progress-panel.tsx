"use client";

import Link from "next/link";
import { ProcessLogPanel } from "@/components/process-log-panel";
import { useProcessPolling } from "@/hooks/use-process-polling";
import { Button } from "@/components/ui";

type ProgressState = {
  foundLinks: number;
  collectedCards: number;
  created: number;
  duplicates: number;
  analysisQueued: number;
  analyzed: number;
  errors: number;
  recommended: number;
  needsReview: number;
  skippedByAi: number;
  sentToAi?: number;
  coverLetters?: number;
  analysisErrors?: number;
};

type StatusResponse = {
  ok: boolean;
  run: {
    id: string;
    status: string;
    statusLabel: string;
    stageLabel: string;
    currentQuery?: string | null;
    currentQueryIndex?: number | null;
    totalQueries?: number | null;
    totalFound: number;
    totalCreated: number;
    totalDuplicates: number;
    totalAnalyzed: number;
    totalErrors: number;
    totalRecommended: number;
    totalAnalysisErrors: number;
    totalCoverLetters: number;
  };
  progress: ProgressState;
  logs: string[];
  isStale: boolean;
  minutesSinceUpdate: number;
  isActive: boolean;
};

export function SearchRunProgressPanel({
  runId,
  fallbackProgress,
  onStop
}: {
  runId: string;
  fallbackProgress?: ProgressState;
  onStop?: () => void;
}) {
  const { data } = useProcessPolling<StatusResponse>(runId ? `/api/search/runs/${runId}/status` : null, {
    enabled: Boolean(runId)
  });

  const run = data?.run;
  const progress = data?.progress || fallbackProgress;
  const status = run?.status || "running";
  const isActive = data?.isActive ?? true;

  const collectTotal = Math.max(run?.totalQueries || 1, 1);
  const collectCurrent = run?.currentQueryIndex || 0;
  const collectPercent = Math.min(100, Math.round((collectCurrent / collectTotal) * 100));

  const aiTotal = Math.max(progress?.sentToAi || 0, progress?.analysisQueued || 0);
  const aiCurrent = progress?.analyzed || 0;
  const aiPercent = aiTotal > 0 ? Math.min(100, Math.round((aiCurrent / aiTotal) * 100)) : 0;
  const showAiBar = aiTotal > 0;

  return (
    <div className="rounded-md border border-[var(--line)] bg-[var(--soft)] p-4 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="font-medium">{run?.statusLabel || "Выполняется"}</div>
          <div className="mt-1 text-xs text-[var(--muted)]">
            {run?.stageLabel || "—"}
            {run?.currentQuery ? ` · ${run.currentQuery}` : ""}
            {data?.isStale ? ` · не обновлялся ${data.minutesSinceUpdate} мин` : ""}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {isActive && onStop ? (
            <Button variant="secondary" onClick={onStop}>
              Остановить
            </Button>
          ) : null}
          <Link href={`/search/runs/${runId}`} className="rounded-md border border-[var(--line)] px-3 py-2 text-xs hover:bg-[var(--soft)]">
            Открыть детали
          </Link>
        </div>
      </div>

      <div className="mt-4 grid gap-3">
        <ProgressBar label={`Поиск${run?.currentQueryIndex ? `: запрос ${run.currentQueryIndex} из ${run.totalQueries}` : ""}`} percent={collectPercent} />
        {showAiBar ? <ProgressBar label={`AI-анализ: ${aiCurrent} из ${aiTotal}`} percent={aiPercent} /> : null}
      </div>

      {progress ? (
        <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-[var(--muted)] sm:grid-cols-4">
          <span>Найдено ссылок: {progress.foundLinks}</span>
          <span>Собрано карточек: {progress.collectedCards}</span>
          <span>Новых: {progress.created}</span>
          <span>Дублей: {progress.duplicates}</span>
          <span>AI завершено: {progress.analyzed}</span>
          <span>AI ошибок: {progress.analysisErrors ?? run?.totalAnalysisErrors ?? 0}</span>
          <span>Рекомендовано: {progress.recommended}</span>
          <span>Писем: {progress.coverLetters ?? run?.totalCoverLetters ?? 0}</span>
        </div>
      ) : null}

      {data?.logs?.length ? (
        <div className="mt-4">
          <ProcessLogPanel lines={data.logs.slice(-30)} maxHeightClass="max-h-48" textSizeClass="text-xs" autoScroll />
        </div>
      ) : null}

      {status === "stale" ? (
        <p className="mt-3 text-xs text-amber-700">
          Похоже, поиск завис. Можно пометить как остановленный или повторить запуск.
        </p>
      ) : null}
    </div>
  );
}

function ProgressBar({ label, percent }: { label: string; percent: number }) {
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs text-[var(--muted)]">
        <span>{label}</span>
        <span>{percent}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-zinc-800">
        <div className="h-full rounded-full bg-[var(--accent)] transition-all" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
