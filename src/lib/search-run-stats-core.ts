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

const skipItemStatuses = new Set(["skipped_not_vacancy", "skipped_invalid_description", "duplicate"]);
const newItemStatuses = new Set(["created", "needs_review"]);
const aiItemStatuses = new Set(["analyzed", "analysis_error"]);

export type SearchRunItemLike = {
  status: string;
  vacancyId?: string | null;
  errorCode?: string | null;
  vacancy?: {
    status: string;
    coverLetters?: Array<{ id: string }>;
  } | null;
};

export type SearchRunLike = {
  totalFound: number;
  totalCreated: number;
  totalDuplicates: number;
  totalAnalyzed: number;
  totalErrors: number;
  totalRecommended: number;
  totalAnalysisErrors: number;
  totalCoverLetters: number;
};

export function aggregateSearchRunItems(
  items: SearchRunItemLike[],
  progress: ProgressState = {},
  errorLogCount = 0
) {
  const totalDuplicates = items.filter((item) => item.status === "duplicate").length;
  const totalCreated = items.filter((item) => newItemStatuses.has(item.status)).length;
  const totalAnalyzed = items.filter((item) => item.status === "analyzed").length;
  const totalAnalysisErrors = items.filter((item) => item.status === "analysis_error").length;
  const skippedNotVacancy = items.filter((item) => item.status === "skipped_not_vacancy").length;
  const skippedInvalidDescription = items.filter((item) => item.status === "skipped_invalid_description").length;

  const vacancies = items.map((item) => item.vacancy).filter(Boolean);
  const totalRecommended = vacancies.filter(
    (vacancy) => vacancy && vacancy.status === "ai_recommended"
  ).length;
  const readyToApply = vacancies.filter(
    (vacancy) => vacancy && vacancy.status === "ready_to_apply" && (vacancy.coverLetters?.length || 0) > 0
  ).length;
  const totalCoverLetters = vacancies.reduce((sum, vacancy) => sum + (vacancy?.coverLetters?.length || 0), 0);
  const invalidSource = vacancies.filter((vacancy) => vacancy?.status === "invalid_source").length;
  const validVacancies = items.filter(
    (item) => item.vacancyId && !skipItemStatuses.has(item.status)
  ).length;

  const sentToAi = items.filter((item) => aiItemStatuses.has(item.status)).length;
  const totalFound = Math.max(progress.foundLinks || 0, items.length);
  const totalErrors = Math.max(totalAnalysisErrors, errorLogCount);

  return {
    totalFound,
    totalCreated,
    totalDuplicates,
    totalAnalyzed,
    totalAnalysisErrors,
    totalRecommended,
    totalCoverLetters,
    totalErrors,
    skippedNotVacancy,
    skippedInvalidDescription,
    sentToAi,
    invalidSource,
    validVacancies,
    readyToApply,
    needsReview: vacancies.filter((v) => v?.status === "needs_review").length
  };
}

export function computeSearchRunDisplayStats(
  items: SearchRunItemLike[],
  progress: ProgressState,
  run: SearchRunLike
) {
  const derived = aggregateSearchRunItems(items, progress);
  const storedMismatch =
    (run.totalFound === 0 && items.length > 0) ||
    run.totalCreated !== derived.totalCreated ||
    run.totalDuplicates !== derived.totalDuplicates;

  return {
    ...derived,
    useDerived: storedMismatch,
    metrics: {
      totalFound: storedMismatch ? derived.totalFound : run.totalFound,
      totalCreated: storedMismatch ? derived.totalCreated : run.totalCreated,
      totalDuplicates: storedMismatch ? derived.totalDuplicates : run.totalDuplicates,
      totalAnalyzed: storedMismatch ? derived.totalAnalyzed : run.totalAnalyzed,
      totalAnalysisErrors: storedMismatch ? derived.totalAnalysisErrors : run.totalAnalysisErrors,
      totalRecommended: storedMismatch ? derived.totalRecommended : run.totalRecommended,
      totalCoverLetters: storedMismatch ? derived.totalCoverLetters : run.totalCoverLetters,
      totalErrors: storedMismatch ? derived.totalErrors : run.totalErrors,
      validVacancies: derived.validVacancies,
      skippedNotVacancy: derived.skippedNotVacancy,
      skippedInvalidDescription: derived.skippedInvalidDescription,
      sentToAi: derived.sentToAi,
      invalidSource: derived.invalidSource,
      readyToApply: derived.readyToApply
    }
  };
}

export function searchRunItemStatusLabel(status: string) {
  const labels: Record<string, string> = {
    created: "Новая вакансия",
    duplicate: "Дубль",
    needs_review: "На проверке",
    analyzed: "AI-анализ выполнен",
    analysis_error: "Ошибка AI",
    skipped_not_vacancy: "Служебная ссылка",
    skipped_invalid_description: "Плохое описание",
    invalid_source: "Невалидный источник",
    error: "Ошибка"
  };
  return labels[status] || status;
}

export function isSearchRunItemJunk(status: string, hasVacancy: boolean) {
  if (status === "skipped_not_vacancy" || status === "skipped_invalid_description" || status === "invalid_source") {
    return true;
  }
  if (status === "duplicate" && !hasVacancy) return true;
  return false;
}

export function groupSearchRunItemsForDisplay<T extends { id: string; status: string; sourceUrl: string }>(items: T[]) {
  const junkStatuses = new Set(["skipped_not_vacancy", "skipped_invalid_description"]);
  const regular: T[] = [];
  const junk: T[] = [];

  for (const item of items) {
    if (junkStatuses.has(item.status)) junk.push(item);
    else regular.push(item);
  }

  return { regular, junk };
}
