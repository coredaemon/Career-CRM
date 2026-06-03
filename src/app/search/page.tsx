import { HhSearchForm } from "@/components/hh-search-form";
import { SearchHistorySidebar, type SearchRunHistoryItem } from "@/components/search-history-sidebar";
import { Card, PageHeader } from "@/components/ui";
import { fromJsonText } from "@/lib/json";
import { prisma } from "@/lib/prisma";
import { markStaleSearchRuns } from "@/lib/stale-process";

export const dynamic = "force-dynamic";

export default async function SearchPage() {
  await markStaleSearchRuns();

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

  const history: SearchRunHistoryItem[] = runs.map((run) => ({
    id: run.id,
    status: run.status,
    profileTitle: run.searchProfile?.title || "Профиль удалён",
    startedAt: run.startedAt.toISOString(),
    finishedAt: run.finishedAt?.toISOString() ?? null,
    queries: fromJsonText<string[]>(run.queriesJson, []),
    totalFound: run.totalFound,
    totalCreated: run.totalCreated,
    totalDuplicates: run.totalDuplicates,
    totalAnalyzed: run.totalAnalyzed,
    totalErrors: run.totalErrors,
    totalRecommended: run.totalRecommended,
    totalAnalysisErrors: run.totalAnalysisErrors,
    updatedAt: run.updatedAt.toISOString()
  }));

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
            <SearchHistorySidebar runs={history} />
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
