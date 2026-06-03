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
      take: 8,
      include: { searchProfile: true }
    })
  ]);

  return (
    <>
      <PageHeader
        title="Поиск вакансий"
        description="Сбор вакансий с hh через локальный браузер. CareerOS не отправляет отклики, не обходит капчи и не хранит логин или пароль hh."
      />
      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
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
                {runs.map((run) => (
                  <div key={run.id} className="rounded-md border border-[var(--line)] p-3 text-sm">
                    <div className="font-medium">{run.searchProfile?.title || "Профиль удалён"}</div>
                    <div className="mt-1 text-xs text-[var(--muted)]">
                      {run.startedAt.toLocaleString("ru-RU")} · {run.status}
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-[var(--muted)]">
                      <span>найдено: {run.totalFound}</span>
                      <span>новых: {run.totalCreated}</span>
                      <span>дублей: {run.totalDuplicates}</span>
                      <span>AI: {run.totalAnalyzed}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
          <Card>
            <h2 className="text-lg font-semibold tracking-normal">Безопасный режим</h2>
            <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
              Браузерный профиль хранится в ignored-папке <code>browser-profile/</code>. Загруженные данные вакансий остаются только в локальной SQLite-базе.
            </p>
          </Card>
        </aside>
      </div>
    </>
  );
}
