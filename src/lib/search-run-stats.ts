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
  skippedNotVacancy?: number;
  skippedInvalidDescription?: number;
  sentToAi?: number;
  invalidSource?: number;
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
  const skippedNotVacancy = items.filter((item) => item.status === "skipped_not_vacancy").length;
  const skippedInvalidDescription = items.filter((item) => item.status === "skipped_invalid_description").length;

  const vacancies = items.map((item) => item.vacancy).filter(Boolean);
  const totalRecommended = vacancies.filter(
    (vacancy) => vacancy && (vacancy.status === "ai_recommended" || vacancy.status === "ready_to_apply")
  ).length;
  const readyToApply = vacancies.filter(
    (vacancy) => vacancy && vacancy.status === "ready_to_apply" && vacancy.coverLetters.length > 0
  ).length;
  const totalCoverLetters = vacancies.reduce((sum, vacancy) => sum + (vacancy?.coverLetters.length || 0), 0);
  const invalidSource = vacancies.filter((vacancy) => vacancy?.status === "invalid_source").length;
  const validVacancies = items.filter(
    (item) => item.status === "created" || item.status === "analyzed" || item.status === "needs_review"
  ).length;

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
    coverLetters: totalCoverLetters,
    skippedNotVacancy: Math.max(progress.skippedNotVacancy || 0, skippedNotVacancy),
    skippedInvalidDescription: Math.max(progress.skippedInvalidDescription || 0, skippedInvalidDescription),
    sentToAi: progress.sentToAi ?? totalAnalyzed,
    invalidSource: Math.max(progress.invalidSource || 0, invalidSource),
    validVacancies
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

export function searchRunItemStatusLabel(status: string) {
  const labels: Record<string, string> = {
    created: "Сохранена",
    duplicate: "Дубль",
    needs_review: "На проверке",
    analyzed: "AI готово",
    analysis_error: "Ошибка AI",
    skipped_not_vacancy: "Не вакансия (URL)",
    skipped_invalid_description: "Плохое описание"
  };
  return labels[status] || status;
}
