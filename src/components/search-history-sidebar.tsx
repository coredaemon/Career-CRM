"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatDuration, searchRunStatusLabel } from "@/lib/process-status";

export type SearchRunHistoryItem = {
  id: string;
  status: string;
  profileTitle: string;
  startedAt: string;
  finishedAt: string | null;
  queries: string[];
  totalFound: number;
  totalCreated: number;
  totalDuplicates: number;
  totalAnalyzed: number;
  totalErrors: number;
  totalRecommended: number;
  totalAnalysisErrors: number;
  updatedAt: string;
};

export function SearchHistorySidebar({ runs }: { runs: SearchRunHistoryItem[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState("");

  async function markStopped(id: string) {
    setBusyId(id);
    await fetch(`/api/search/runs/${id}/mark-stopped`, { method: "POST" });
    setBusyId("");
    router.refresh();
  }

  if (runs.length === 0) {
    return <p className="mt-3 text-sm text-[var(--muted)]">Запусков пока нет.</p>;
  }

  return (
    <div className="mt-4 grid gap-3">
      {runs.map((run) => {
        const startedAt = new Date(run.startedAt);
        const updatedAt = new Date(run.updatedAt);
        const finishedAt = run.finishedAt ? new Date(run.finishedAt) : null;
        const canStop = run.status === "running" || run.status === "stale";
        const hasResults = run.totalCreated > 0 || run.totalFound > 0;

        return (
          <div key={run.id} className="rounded-md border border-[var(--line)] p-3 text-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="font-medium">{run.profileTitle}</div>
                <span className="rounded-md bg-[var(--soft)] px-2 py-1 text-xs">{searchRunStatusLabel(run.status, updatedAt)}</span>
            </div>
            <div className="mt-1 text-xs text-[var(--muted)]">
              старт: {startedAt.toLocaleString("ru-RU")}
              {finishedAt ? ` · финиш: ${finishedAt.toLocaleString("ru-RU")}` : ""}
              {finishedAt ? ` · ${formatDuration(startedAt, finishedAt)}` : ""}
            </div>
            <div className="mt-2 text-xs text-[var(--muted)]">Запросы: {run.queries.slice(0, 2).join(", ") || "не указаны"}</div>
            <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-[var(--muted)]">
              <span>найдено: {run.totalFound}</span>
              <span>новых: {run.totalCreated}</span>
              <span>дублей: {run.totalDuplicates}</span>
              <span>AI: {run.totalAnalyzed}</span>
              <span>AI ошибок: {run.totalAnalysisErrors}</span>
              <span>ошибок: {run.totalErrors}</span>
              <span>рекомендовано: {run.totalRecommended}</span>
            </div>
            <p className="mt-2 text-xs text-[var(--muted)]">
              {hasResults ? "Можно перейти к результатам." : "Результаты пока не сохранены."}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link href={`/search/runs/${run.id}`} className="rounded-md border border-[var(--line)] px-3 py-1.5 text-xs hover:bg-[var(--soft)]">
                Открыть детали
              </Link>
              <Link href="/vacancies" className="rounded-md border border-[var(--line)] px-3 py-1.5 text-xs hover:bg-[var(--soft)]">
                Найденные вакансии
              </Link>
              <Link href="/vacancies/recommended" className="rounded-md border border-[var(--line)] px-3 py-1.5 text-xs hover:bg-[var(--soft)]">
                Рекомендованные
              </Link>
              <Link href="/search" className="rounded-md border border-[var(--line)] px-3 py-1.5 text-xs hover:bg-[var(--soft)]">
                Повторить запуск
              </Link>
              {canStop ? (
                <button
                  type="button"
                  disabled={busyId === run.id}
                  onClick={() => markStopped(run.id)}
                  className="rounded-md border border-[var(--line)] px-3 py-1.5 text-xs hover:bg-[var(--soft)] disabled:opacity-50"
                >
                  Пометить остановленным
                </button>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
