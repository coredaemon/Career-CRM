import Link from "next/link";
import { ProcessesControlPanel } from "@/components/processes-control-panel";
import { Card, PageHeader } from "@/components/ui";
import { fromJsonText } from "@/lib/json";
import { prisma } from "@/lib/prisma";
import { buildProcessRunUiState, buildSearchRunUiState } from "@/lib/process-status";
import { markAllStaleProcesses } from "@/lib/stale-process";

export const dynamic = "force-dynamic";

export default async function ProcessesPage() {
  await markAllStaleProcesses();

  const [searchRuns, processRuns] = await Promise.all([
    prisma.searchRun.findMany({
      where: { listHidden: false },
      orderBy: { startedAt: "desc" },
      take: 15,
      include: { searchProfile: true }
    }),
    prisma.processRun.findMany({
      where: { listHidden: false },
      orderBy: { startedAt: "desc" },
      take: 15
    })
  ]);

  const searchCards = searchRuns.map((run) => {
    const state = buildSearchRunUiState(
      {
        id: run.id,
        status: run.status,
        stopRequested: run.stopRequested,
        stage: run.stage,
        startedAt: run.startedAt,
        updatedAt: run.updatedAt,
        finishedAt: run.finishedAt,
        currentQueryIndex: run.currentQueryIndex,
        totalQueries: run.totalQueries,
        searchProfileTitle: run.searchProfile?.title
      },
      { progress: fromJsonText(run.progressJson, {}) }
    );
    return { id: run.id, kind: "search" as const, title: state.title, state };
  });

  const processCards = processRuns.map((run) => ({
    id: run.id,
    kind: "process" as const,
    title: run.title,
    state: buildProcessRunUiState(run)
  }));

  const activeCount =
    searchRuns.filter((r) => r.status === "running" || r.status === "queued").length +
    processRuns.filter((r) => r.status === "running" || r.status === "queued").length;
  const staleCount =
    searchRuns.filter((r) => r.status === "stale").length + processRuns.filter((r) => r.status === "stale").length;
  const errorCount =
    searchRuns.filter((r) => r.status === "error").length + processRuns.filter((r) => r.status === "error").length;

  return (
    <>
      <PageHeader title="Процессы" description="Активные, зависшие и недавние фоновые задачи CareerOS." />
      <ProcessesControlPanel
        activeCount={activeCount}
        staleCount={staleCount}
        errorCount={errorCount}
        searchRuns={searchCards}
        processRuns={processCards}
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="text-lg font-semibold">Поиск вакансий</h2>
          <div className="mt-4 grid gap-3">
            {searchRuns.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">Запусков пока нет.</p>
            ) : (
              searchRuns.map((run) => {
                const state = buildSearchRunUiState(
                  {
                    id: run.id,
                    status: run.status,
                    stopRequested: run.stopRequested,
                    stage: run.stage,
                    startedAt: run.startedAt,
                    updatedAt: run.updatedAt,
                    finishedAt: run.finishedAt,
                    currentQueryIndex: run.currentQueryIndex,
                    totalQueries: run.totalQueries,
                    searchProfileTitle: run.searchProfile?.title
                  },
                  { progress: fromJsonText(run.progressJson, {}) }
                );
                return (
                  <div key={run.id} className="rounded-md border border-[var(--line)] p-3 text-sm">
                    <div className="flex justify-between gap-3">
                      <span className="font-medium">{state.title}</span>
                      <span className="text-xs">{state.humanStatusLabel}</span>
                    </div>
                    <p className="mt-1 text-xs text-[var(--muted)]">
                      {state.displayCurrent}/{state.displayTotal} · {state.elapsedLabel}
                    </p>
                    <Link href={state.href} className="mt-2 inline-block text-xs underline">
                      Открыть детали
                    </Link>
                  </div>
                );
              })
            )}
          </div>
        </Card>
        <Card>
          <h2 className="text-lg font-semibold">AI и другие задачи</h2>
          <div className="mt-4 grid gap-3">
            {processRuns.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">Фоновых задач пока нет.</p>
            ) : (
              processRuns.map((run) => {
                const state = buildProcessRunUiState(run);
                return (
                  <div key={run.id} className="rounded-md border border-[var(--line)] p-3 text-sm">
                    <div className="flex justify-between gap-3">
                      <span className="font-medium">{run.title}</span>
                      <span className="text-xs">{state.humanStatusLabel}</span>
                    </div>
                    <p className="mt-1 text-xs text-[var(--muted)]">
                      {state.displayCurrent} / {state.displayTotal} · {state.elapsedLabel}
                    </p>
                    <Link href={state.href} className="mt-2 inline-block text-xs underline">
                      Открыть детали
                    </Link>
                  </div>
                );
              })
            )}
          </div>
        </Card>
      </div>
    </>
  );
}
