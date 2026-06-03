import { fromJsonText } from "@/lib/json";
import { prisma } from "@/lib/prisma";
import { countVacanciesEligibleForBulk, findBlockingVacancyAnalysisProcess } from "@/lib/process-queries";
import { buildProcessRunUiState, buildSearchRunUiState } from "@/lib/process-status";
import { markAllStaleProcesses } from "@/lib/stale-process";

export async function getActiveProcessesSummary() {
  await markAllStaleProcesses();

  const [searchRuns, processRuns, eligibleForBulk, analysisErrors, readyToApply, staleSearchCount, staleProcessCount, blockingProcess] =
    await Promise.all([
      prisma.searchRun.findMany({
        where: { status: { in: ["running", "stale", "queued"] }, listHidden: false },
        orderBy: { startedAt: "desc" },
        take: 5,
        include: { searchProfile: true }
      }),
      prisma.processRun.findMany({
        where: { status: { in: ["running", "stale", "queued"] }, listHidden: false },
        orderBy: { startedAt: "desc" },
        take: 5
      }),
      countVacanciesEligibleForBulk(),
      prisma.vacancy.count({ where: { status: "analysis_error" } }),
      prisma.vacancy.count({
        where: {
          status: "ready_to_apply",
          coverLetters: { some: {} }
        }
      }),
      prisma.searchRun.count({ where: { status: "stale", listHidden: false } }),
      prisma.processRun.count({ where: { status: "stale", listHidden: false } }),
      findBlockingVacancyAnalysisProcess()
    ]);

  const actions: Array<{ message: string; href: string; label: string }> = [];

  if (eligibleForBulk > 0 && !blockingProcess) {
    actions.push({
      message: `Есть ${eligibleForBulk} вакансий без AI-анализа`,
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

  const activeVacancyAnalysis = blockingProcess ? buildProcessRunUiState(blockingProcess) : null;

  return {
    searchRuns: searchRuns.map((run) => {
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
      return {
        id: run.id,
        title: state.title,
        status: state.status,
        stage: run.stage,
        href: state.href,
        state
      };
    }),
    processRuns: processRuns.map((run) => {
      const state = buildProcessRunUiState(run);
      return {
        id: run.id,
        title: run.title,
        status: state.status,
        type: run.type,
        href: state.href,
        progressCurrent: state.displayCurrent,
        progressTotal: state.displayTotal,
        state
      };
    }),
    activeVacancyAnalysis,
    eligibleForBulk,
    staleCount: staleSearchCount + staleProcessCount,
    analysisErrorCount: analysisErrors,
    actions
  };
}
