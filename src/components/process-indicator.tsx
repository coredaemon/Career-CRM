"use client";

import Link from "next/link";
import { useProcessPolling } from "@/hooks/use-process-polling";

type NormalizedState = {
  humanSummary: string;
  displayCurrent: number;
  displayTotal: number;
  href: string;
  etaLabel: string;
};

type ActiveResponse = {
  ok: boolean;
  searchRuns: Array<{ id: string; title: string; status: string; href: string; state?: NormalizedState }>;
  processRuns: Array<{ id: string; title: string; status: string; href: string; state?: NormalizedState }>;
  activeVacancyAnalysis?: NormalizedState | null;
  staleCount: number;
  analysisErrorCount: number;
};

export function ProcessIndicator() {
  const { data } = useProcessPolling<ActiveResponse>("/api/processes/active", { intervalMs: 3000 });

  if (!data?.ok) return null;

  const activeSearch = data.searchRuns.find((run) => run.status === "running" || run.status === "stopping");
  const activeProcess =
    data.activeVacancyAnalysis ||
    data.processRuns.find((run) => run.status === "running" || run.status === "queued" || run.status === "stopping")?.state;

  if (!activeSearch && !activeProcess && data.staleCount === 0 && data.analysisErrorCount === 0) {
    return null;
  }

  return (
    <div className="mt-5 rounded-md border border-[var(--line)] bg-[var(--soft)] p-3 text-xs leading-5">
      {activeSearch ? (
        <div>
          <Link href={activeSearch.href} className="font-medium hover:text-[var(--accent)]">
            {activeSearch.state?.humanSummary || `Идёт поиск: ${activeSearch.title}`}
          </Link>
        </div>
      ) : null}
      {activeProcess ? (
        <div className={activeSearch ? "mt-2" : ""}>
          <Link href={activeProcess.href} className="font-medium hover:text-[var(--accent)]">
            {activeProcess.humanSummary ||
              `AI анализирует ${activeProcess.displayCurrent} из ${activeProcess.displayTotal}`}
          </Link>
          {activeProcess.etaLabel ? <div className="mt-1 text-[var(--muted)]">{activeProcess.etaLabel}</div> : null}
        </div>
      ) : null}
      {data.staleCount > 0 ? (
        <div className="mt-2 text-amber-700">
          <Link href="/processes" className="underline">
            Есть {data.staleCount} зависших процессов
          </Link>
        </div>
      ) : null}
      {data.analysisErrorCount > 0 ? (
        <div className="mt-2">
          <Link href="/vacancies?status=analysis_error" className="underline">
            Есть {data.analysisErrorCount} ошибок AI
          </Link>
        </div>
      ) : null}
    </div>
  );
}
