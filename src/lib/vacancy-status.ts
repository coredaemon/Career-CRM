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
  "skipped"
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
  skipped: "Пропущена"
};

export function vacancyStatusLabel(status: string) {
  return vacancyStatusLabels[status as VacancyStatus] ?? status;
}

export function statusFromAiDecision(decision: "yes" | "maybe" | "no"): VacancyStatus {
  if (decision === "yes") return "ai_recommended";
  if (decision === "no") return "rejected_by_ai";
  return "needs_review";
}
