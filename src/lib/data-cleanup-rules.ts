export const FULL_VACANCY_RESET_CONFIRM_TEXT = "УДАЛИТЬ ВАКАНСИИ";

export const cleanupTypeLabels: Record<string, string> = {
  untouched_vacancies: "нетронутые вакансии",
  analysis_errors: "ошибки анализа",
  invalid_sources: "невалидные источники",
  old_runs: "старые процессы и запуски",
  full_vacancy_reset: "полная очистка вакансий и процессов"
};

const protectedStatuses = new Set(["applied", "waiting_response", "no_response", "rejected"]);

export type CleanupVacancyCandidate = {
  status: string;
  applications?: unknown[];
  coverLetters?: unknown[];
  skipReasonJson?: string | null;
  interactions?: { type?: string | null; summary?: string | null }[];
};

export function requiresFullResetConfirmation(type: string, confirmText: string | null | undefined) {
  return type === "full_vacancy_reset" && confirmText !== FULL_VACANCY_RESET_CONFIRM_TEXT;
}

export function isProtectedVacancyForCleanup(vacancy: CleanupVacancyCandidate) {
  if (protectedStatuses.has(vacancy.status)) return true;
  if ((vacancy.applications || []).length > 0) return true;
  if ((vacancy.coverLetters || []).length > 0) return true;
  if (vacancy.skipReasonJson) return true;
  return (vacancy.interactions || []).some((interaction) => {
    const type = interaction.type || "";
    return !type.startsWith("bulk_cleanup") && type !== "vacancy_created" && type !== "vacancy_analyzed" && type !== "cover_letter_created";
  });
}

export function shouldDeleteDraftObservation(status: string, includeDraftLearningObservations: boolean) {
  return status === "draft" && includeDraftLearningObservations;
}

export function shouldPreserveAcceptedObservation(status: string) {
  return status === "accepted";
}

