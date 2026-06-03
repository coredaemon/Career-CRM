import { fromJsonText } from "@/lib/json";
import { prisma } from "@/lib/prisma";
import {
  aggregateSearchRunItems,
  computeSearchRunDisplayStats,
  groupSearchRunItemsForDisplay,
  isSearchRunItemJunk,
  searchRunItemStatusLabel,
  type SearchRunItemLike,
  type SearchRunLike
} from "@/lib/search-run-stats-core";

export {
  aggregateSearchRunItems,
  computeSearchRunDisplayStats,
  groupSearchRunItemsForDisplay,
  isSearchRunItemJunk,
  searchRunItemStatusLabel,
  type SearchRunItemLike,
  type SearchRunLike
};

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
  validVacancies?: number;
  analysisQueued?: number;
  skippedByAi?: number;
  readyToApply?: number;
  analysisErrors?: number;
  coverLetters?: number;
};

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
  const errors = fromJsonText<string[]>(run.errorLogJson, []);
  const stats = aggregateSearchRunItems(run.items, progress, errors.length);

  const updatedProgress: ProgressState = {
    ...progress,
    foundLinks: Math.max(progress.foundLinks || 0, stats.totalFound),
    created: stats.totalCreated,
    duplicates: stats.totalDuplicates,
    analyzed: stats.totalAnalyzed,
    errors: stats.totalErrors,
    recommended: stats.totalRecommended,
    needsReview: stats.needsReview,
    readyToApply: stats.readyToApply,
    analysisErrors: stats.totalAnalysisErrors,
    coverLetters: stats.totalCoverLetters,
    skippedNotVacancy: stats.skippedNotVacancy,
    skippedInvalidDescription: stats.skippedInvalidDescription,
    sentToAi: stats.sentToAi,
    invalidSource: stats.invalidSource,
    validVacancies: stats.validVacancies,
    analysisQueued: Math.max(progress.analysisQueued || 0, stats.sentToAi)
  };

  return prisma.searchRun.update({
    where: { id: runId },
    data: {
      totalFound: stats.totalFound,
      totalCreated: stats.totalCreated,
      totalDuplicates: stats.totalDuplicates,
      totalAnalyzed: stats.totalAnalyzed,
      totalErrors: stats.totalErrors,
      totalRecommended: stats.totalRecommended,
      totalAnalysisErrors: stats.totalAnalysisErrors,
      totalCoverLetters: stats.totalCoverLetters,
      progressJson: JSON.stringify(updatedProgress)
    }
  });
}

export async function getSearchRunStatsSummary(runId: string) {
  const run = await recalculateSearchRunStats(runId);
  const progress = fromJsonText<ProgressState>(run.progressJson, {});
  return { run, progress };
}
