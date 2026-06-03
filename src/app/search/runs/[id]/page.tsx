import { notFound } from "next/navigation";
import { SearchRunDetailClient } from "@/components/search-run-detail-client";
import { PageHeader } from "@/components/ui";
import { fromJsonText } from "@/lib/json";
import { prisma } from "@/lib/prisma";
import { recalculateSearchRunStats } from "@/lib/search-run-stats";
import { markStaleSearchRuns } from "@/lib/stale-process";
import { searchRunStatusLabel } from "@/lib/process-status";

export const dynamic = "force-dynamic";

export default async function SearchRunDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await markStaleSearchRuns();

  let run = await prisma.searchRun.findUnique({
    where: { id },
    include: {
      searchProfile: true,
      items: {
        orderBy: { createdAt: "desc" },
        include: {
          vacancy: { include: { company: true } }
        }
      }
    }
  });

  if (!run) notFound();

  if (run.status !== "running") {
    await recalculateSearchRunStats(id);
    run = await prisma.searchRun.findUniqueOrThrow({
      where: { id },
      include: {
        searchProfile: true,
        items: {
          orderBy: { createdAt: "desc" },
          include: { vacancy: { include: { company: true } } }
        }
      }
    });
  }

  const logs = fromJsonText<string[]>(run.logJson, []);
  const errors = fromJsonText<string[]>(run.errorLogJson, []);
  const queries = fromJsonText<string[]>(run.queriesJson, []);
  const progress = fromJsonText<Record<string, number>>(run.progressJson, {});

  return (
    <>
      <PageHeader
        title="Детали поиска"
        description={`${run.searchProfile?.title || "Профиль удалён"} · ${searchRunStatusLabel(run.status, run.updatedAt)} · ${run.startedAt.toLocaleString("ru-RU")}`}
      />
      <SearchRunDetailClient
        initial={{
          id: run.id,
          status: run.status,
          stage: run.stage,
          startedAt: run.startedAt.toISOString(),
          finishedAt: run.finishedAt?.toISOString(),
          updatedAt: run.updatedAt.toISOString(),
          currentQuery: run.currentQuery,
          currentQueryIndex: run.currentQueryIndex,
          totalQueries: run.totalQueries,
          profileTitle: run.searchProfile?.title || "Профиль удалён",
          totalFound: run.totalFound,
          totalCreated: run.totalCreated,
          totalDuplicates: run.totalDuplicates,
          totalAnalyzed: run.totalAnalyzed,
          totalErrors: run.totalErrors,
          totalRecommended: run.totalRecommended,
          totalAnalysisErrors: run.totalAnalysisErrors,
          totalCoverLetters: run.totalCoverLetters,
          queries,
          logs,
          errors,
          progress,
          items: run.items.map((item) => ({
            id: item.id,
            status: item.status,
            errorCode: item.errorCode,
            errorMessage: item.errorMessage,
            sourceUrl: item.sourceUrl,
            vacancy: item.vacancy
              ? {
                  id: item.vacancy.id,
                  title: item.vacancy.title,
                  status: item.vacancy.status,
                  companyName: item.vacancy.company?.name
                }
              : null
          }))
        }}
      />
    </>
  );
}
