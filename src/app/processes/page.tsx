import Link from "next/link";
import { Card, PageHeader } from "@/components/ui";
import { prisma } from "@/lib/prisma";
import { formatDuration, processStatusLabel } from "@/lib/process-status";
import { markAllStaleProcesses } from "@/lib/stale-process";

export const dynamic = "force-dynamic";

export default async function ProcessesPage() {
  await markAllStaleProcesses();

  const [searchRuns, processRuns] = await Promise.all([
    prisma.searchRun.findMany({ orderBy: { startedAt: "desc" }, take: 15, include: { searchProfile: true } }),
    prisma.processRun.findMany({ orderBy: { startedAt: "desc" }, take: 15 })
  ]);

  return (
    <>
      <PageHeader title="Процессы" description="Активные, зависшие и недавние фоновые задачи CareerOS." />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="text-lg font-semibold">Поиск вакансий</h2>
          <div className="mt-4 grid gap-3">
            {searchRuns.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">Запусков пока нет.</p>
            ) : (
              searchRuns.map((run) => (
                <div key={run.id} className="rounded-md border border-[var(--line)] p-3 text-sm">
                  <div className="flex justify-between gap-3">
                    <span className="font-medium">{run.searchProfile?.title || "Поиск"}</span>
                    <span className="text-xs">{processStatusLabel(run.status, run.updatedAt)}</span>
                  </div>
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    {run.startedAt.toLocaleString("ru-RU")}
                    {run.finishedAt ? ` · ${formatDuration(run.startedAt, run.finishedAt)}` : ""}
                  </p>
                  <Link href={`/search/runs/${run.id}`} className="mt-2 inline-block text-xs underline">
                    Открыть детали
                  </Link>
                </div>
              ))
            )}
          </div>
        </Card>
        <Card>
          <h2 className="text-lg font-semibold">AI и другие задачи</h2>
          <div className="mt-4 grid gap-3">
            {processRuns.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">Фоновых задач пока нет.</p>
            ) : (
              processRuns.map((run) => (
                <div key={run.id} className="rounded-md border border-[var(--line)] p-3 text-sm">
                  <div className="flex justify-between gap-3">
                    <span className="font-medium">{run.title}</span>
                    <span className="text-xs">{processStatusLabel(run.status, run.updatedAt)}</span>
                  </div>
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    {run.progressCurrent} / {run.progressTotal} · {run.startedAt.toLocaleString("ru-RU")}
                  </p>
                  <Link href={`/processes/${run.id}`} className="mt-2 inline-block text-xs underline">
                    Открыть детали
                  </Link>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </>
  );
}
