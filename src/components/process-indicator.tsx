"use client";

import Link from "next/link";
import { useProcessPolling } from "@/hooks/use-process-polling";

type ActiveResponse = {
  ok: boolean;
  searchRuns: Array<{ id: string; title: string; status: string; href: string }>;
  processRuns: Array<{ id: string; title: string; status: string; progressCurrent: number; progressTotal: number; href: string }>;
  staleCount: number;
  analysisErrorCount: number;
};

export function ProcessIndicator() {
  const { data } = useProcessPolling<ActiveResponse>("/api/processes/active", { intervalMs: 3000 });

  if (!data?.ok) return null;

  const activeSearch = data.searchRuns.find((run) => run.status === "running");
  const activeProcess = data.processRuns.find((run) => run.status === "running");

  if (!activeSearch && !activeProcess && data.staleCount === 0 && data.analysisErrorCount === 0) {
    return null;
  }

  return (
    <div className="mt-5 rounded-md border border-[var(--line)] bg-[var(--soft)] p-3 text-xs leading-5">
      {activeSearch ? (
        <div>
          <Link href={activeSearch.href} className="font-medium hover:text-[var(--accent)]">
            Идёт поиск: {activeSearch.title}
          </Link>
        </div>
      ) : null}
      {activeProcess ? (
        <div className={activeSearch ? "mt-2" : ""}>
          <Link href={activeProcess.href} className="font-medium hover:text-[var(--accent)]">
            AI анализирует {activeProcess.progressCurrent} из {activeProcess.progressTotal}
          </Link>
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
