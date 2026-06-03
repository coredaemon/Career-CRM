import { fromJsonText } from "@/lib/json";
import { prisma } from "@/lib/prisma";

type ProgressState = {
  foundLinks?: number;
  collectedCards?: number;
  created?: number;
  duplicates?: number;
  analyzed?: number;
  errors?: number;
  recommended?: number;
  needsReview?: number;
};

const createdStatuses = new Set(["created", "needs_review", "analyzed", "analysis_error"]);

export async function recalculateSearchRunStats(runId: string) {
  const run = await prisma.searchRun.findUniqueOrThrow({
    where: { id: runId },
    include: {
      items: {
        include: {
          vacancy: {
            include: { coverLetters: { select: { id: true } } }
          }
        }
      }
    }
  });

  const progress = fromJsonText<ProgressState>(run.progressJson, {});
  const items = run.items;

  const totalDuplicates = items.filter((item) => item.status === "duplicate").length;
  const totalCreated = items.filter((item) => createdStatuses.has(item.status)).length;
  const totalAnalyzed = items.filter((item) => item.status === "analyzed").length;
  const totalAnalysisErrors = items.filter((item) => item.status === "analysis_error").length;

  const vacancies = items.map((item) => item.vacancy).filter(Boolean);
  const totalRecommended = vacancies.filter(
    (vacancy) => vacancy && (vacancy.status === "ai_recommended" || vacancy.status === "ready_to_apply")
  ).length;
  const readyToApply = vacancies.filter(
    (vacancy) => vacancy && vacancy.status === "ready_to_apply" && vacancy.coverLetters.length > 0
  ).length;
  const totalCoverLetters = vacancies.reduce((sum, vacancy) => sum + (vacancy?.coverLetters.length || 0), 0);

  const totalFound = Math.max(progress.foundLinks || 0, items.length, run.totalFound);
  const totalErrors = Math.max(progress.errors || 0, totalAnalysisErrors, run.totalErrors);

  const updatedProgress = {
    ...progress,
    foundLinks: totalFound,
    created: totalCreated,
    duplicates: totalDuplicates,
    analyzed: totalAnalyzed,
    errors: totalErrors,
    recommended: totalRecommended,
    needsReview: vacancies.filter((v) => v?.status === "needs_review").length,
    readyToApply,
    analysisErrors: totalAnalysisErrors,
    coverLetters: totalCoverLetters
  };

  return prisma.searchRun.update({
    where: { id: runId },
    data: {
      totalFound,
      totalCreated,
      totalDuplicates,
      totalAnalyzed,
      totalErrors,
      totalRecommended,
      totalAnalysisErrors,
      totalCoverLetters,
      progressJson: JSON.stringify(updatedProgress)
    }
  });
}

export async function getSearchRunStatsSummary(runId: string) {
  const run = await recalculateSearchRunStats(runId);
  const progress = fromJsonText<ProgressState>(run.progressJson, {});
  return { run, progress };
}
