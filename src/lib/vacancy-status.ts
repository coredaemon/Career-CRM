export const vacancyStatuses = [
  "found",
  "ai_recommended",
  "needs_review",
  "rejected_by_ai",
  "ready_to_apply",
  "applied",
  "waiting_response",
  "rejected",
  "no_response",
  "archived",
  "skipped",
  "skipped_invalid",
  "invalid_source",
  "analysis_error"
] as const;

export type VacancyStatus = (typeof vacancyStatuses)[number];

export const vacancyStatusLabels: Record<VacancyStatus, string> = {
  found: "Найдена",
  ai_recommended: "AI рекомендует",
  needs_review: "На проверке",
  rejected_by_ai: "AI не рекомендует",
  ready_to_apply: "Готово к отклику",
  applied: "Отклик отправлен",
  waiting_response: "Ждём ответ",
  rejected: "Отказ",
  no_response: "Нет ответа",
  archived: "Архив",
  skipped: "Пропущена",
  skipped_invalid: "Невалидная",
  invalid_source: "Невалидный источник",
  analysis_error: "Ошибка анализа"
};

export function vacancyStatusLabel(status: string) {
  return vacancyStatusLabels[status as VacancyStatus] ?? status;
}

export function statusFromAiDecision(decision: "yes" | "maybe" | "no"): VacancyStatus {
  if (decision === "yes") return "ready_to_apply";
  if (decision === "no") return "rejected_by_ai";
  return "needs_review";
}

export function statusFromAiAnalysis(params: {
  shouldApply: "yes" | "maybe" | "no";
  score: number;
}): VacancyStatus {
  if (params.shouldApply === "no") return "rejected_by_ai";
  if (params.shouldApply === "yes") return "ready_to_apply";
  // maybe
  if (params.score >= 75) return "ai_recommended";
  if (params.score >= 50) return "needs_review";
  // score < 50 + maybe means AI is uncertain but score is low — treat as not recommended
  return "rejected_by_ai";
}
