import { fromJsonText } from "@/lib/json";
import { prisma } from "@/lib/prisma";
import { effectiveSearchRunStatus, isStale } from "@/lib/process-status";
import { markAllStaleProcesses } from "@/lib/stale-process";

export async function getActiveProcessesSummary() {
  await markAllStaleProcesses();

  const [searchRuns, processRuns, withoutAi, analysisErrors, readyToApply, staleSearchCount, staleProcessCount] =
    await Promise.all([
      prisma.searchRun.findMany({
        where: { status: { in: ["running", "stale", "queued"] } },
        orderBy: { startedAt: "desc" },
        take: 5,
        include: { searchProfile: true }
      }),
      prisma.processRun.findMany({
        where: { status: { in: ["running", "stale", "queued"] } },
        orderBy: { startedAt: "desc" },
        take: 5
      }),
      prisma.vacancy.count({ where: { OR: [{ matchScore: null }, { aiAnalysisJson: null }] } }),
      prisma.vacancy.count({ where: { status: "analysis_error" } }),
      prisma.vacancy.count({
        where: {
          status: "ready_to_apply",
          coverLetters: { some: {} }
        }
      }),
      prisma.searchRun.count({ where: { status: "stale" } }),
      prisma.processRun.count({ where: { status: "stale" } })
    ]);

  const actions: Array<{ message: string; href: string; label: string }> = [];

  if (withoutAi > 0) {
    actions.push({
      message: `Есть ${withoutAi} вакансий без AI-анализа`,
      href: "/vacancies?status=no_ai",
      label: "Запустить анализ"
    });
  }
  if (analysisErrors > 0) {
    actions.push({
      message: `Есть ${analysisErrors} ошибок AI-анализа`,
      href: "/vacancies?status=analysis_error",
      label: "Повторить ошибки"
    });
  }
  if (readyToApply > 0) {
    actions.push({
      message: `Есть ${readyToApply} вакансий готовых к отклику`,
      href: "/vacancies?status=ready_to_apply",
      label: "Открыть"
    });
  }
  if (staleSearchCount + staleProcessCount > 0) {
    actions.push({
      message: `Есть ${staleSearchCount + staleProcessCount} зависших процессов`,
      href: "/processes",
      label: "Открыть процессы"
    });
  }

  return {
    searchRuns: searchRuns.map((run) => ({
      id: run.id,
      title: run.searchProfile?.title || "Поиск",
      status: effectiveSearchRunStatus(run.status, run.updatedAt),
      stage: run.stage,
      href: `/search/runs/${run.id}`,
      progress: fromJsonText(run.progressJson, {}),
      isStale: run.status === "stale" || (run.status === "running" && isStale(run.updatedAt))
    })),
    processRuns: processRuns.map((run) => ({
      id: run.id,
      title: run.title,
      status: run.status,
      type: run.type,
      href: `/processes/${run.id}`,
      progressCurrent: run.progressCurrent,
      progressTotal: run.progressTotal
    })),
    staleCount: staleSearchCount + staleProcessCount,
    analysisErrorCount: analysisErrors,
    actions
  };
}
