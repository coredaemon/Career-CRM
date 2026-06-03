import Link from "next/link";
import { HhSearchForm } from "@/components/hh-search-form";
import { Card, PageHeader } from "@/components/ui";
import { fromJsonText } from "@/lib/json";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function SearchPage() {
  const [profiles, runs] = await Promise.all([
    prisma.searchProfile.findMany({
      orderBy: { createdAt: "desc" },
      include: { resume: true }
    }),
    prisma.searchRun.findMany({
      orderBy: { startedAt: "desc" },
      take: 10,
      include: { searchProfile: true }
    })
  ]);

  return (
    <>
      <PageHeader
        title="Поиск вакансий"
        description="Сбор вакансий с hh через локальный браузер. CareerOS не отправляет отклики, не обходит капчи и не хранит логин или пароль hh."
      />
      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <HhSearchForm
          profiles={profiles.map((profile) => ({
            id: profile.id,
            title: profile.title,
            summary: profile.summary,
            resumeId: profile.resumeId,
            resumeTitle: profile.resume.title,
            searchQueries: fromJsonText<string[]>(profile.searchQueriesJson, [])
          }))}
        />
        <aside className="grid content-start gap-4">
          <Card>
            <h2 className="text-lg font-semibold tracking-normal">История поиска</h2>
            {runs.length === 0 ? (
              <p className="mt-3 text-sm text-[var(--muted)]">Запусков пока нет.</p>
            ) : (
              <div className="mt-4 grid gap-3">
                {runs.map((run) => {
                  const queries = fromJsonText<string[]>(run.queriesJson, []);
                  return (
                    <div key={run.id} className="rounded-md border border-[var(--line)] p-3 text-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div className="font-medium">{run.searchProfile?.title || "Профиль удалён"}</div>
                        <span className="rounded-md bg-[var(--soft)] px-2 py-1 text-xs">{searchRunStatusLabel(run.status)}</span>
                      </div>
                      <div className="mt-1 text-xs text-[var(--muted)]">
                        старт: {run.startedAt.toLocaleString("ru-RU")}
                        {run.finishedAt ? ` · финиш: ${run.finishedAt.toLocaleString("ru-RU")}` : ""}
                      </div>
                      <div className="mt-2 text-xs text-[var(--muted)]">Запросы: {queries.slice(0, 2).join(", ") || "не указаны"}</div>
                      <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-[var(--muted)]">
                        <span>найдено: {run.totalFound}</span>
                        <span>новых: {run.totalCreated}</span>
                        <span>дублей: {run.totalDuplicates}</span>
                        <span>AI: {run.totalAnalyzed}</span>
                        <span>ошибок: {run.totalErrors}</span>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Link href={`/search/runs/${run.id}`} className="rounded-md border border-[var(--line)] px-3 py-1.5 text-xs hover:bg-[var(--soft)]">
                          Открыть детали
                        </Link>
                        <Link href="/search" className="rounded-md border border-[var(--line)] px-3 py-1.5 text-xs hover:bg-[var(--soft)]">
                          Повторить запуск
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
          <Card>
            <h2 className="text-lg font-semibold tracking-normal">Безопасный режим</h2>
            <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
              Браузерный профиль хранится в ignored-папке <code>browser-profile/</code>. Данные вакансий остаются только в локальной SQLite-базе.
            </p>
          </Card>
        </aside>
      </div>
    </>
  );
}

function searchRunStatusLabel(status: string) {
  const labels: Record<string, string> = {
    running: "выполняется",
    completed: "завершён",
    error: "ошибка",
    stopped: "остановлен"
  };
  return labels[status] || status;
}
