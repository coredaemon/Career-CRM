export const STALE_AFTER_MS = 10 * 60 * 1000;

export type ProcessStatus =
  | "queued"
  | "running"
  | "completed"
  | "error"
  | "stopped"
  | "stale";

export const processStatusLabels: Record<string, string> = {
  queued: "В очереди",
  running: "Выполняется",
  completed: "Завершён",
  error: "Ошибка",
  stopped: "Остановлен",
  stale: "Завис"
};

export const searchRunStatusLabels: Record<string, string> = {
  queued: "В очереди",
  running: "Выполняется",
  completed: "Завершён",
  error: "Ошибка",
  stopped: "Остановлен",
  stale: "Завис"
};

export const searchStageLabels: Record<string, string> = {
  preparing: "Подготовка",
  preparing_browser: "Подготовка браузера",
  opening_hh: "Открываем hh",
  manual_login: "Ожидание входа",
  query: "Выполняем запрос",
  collecting_links: "Собираем ссылки",
  links: "Собираем ссылки",
  card: "Открываем карточку",
  saving: "Сохраняем вакансию",
  analyzing_ai: "AI-анализ",
  stopping: "Остановка",
  completed: "Завершено",
  stopped: "Остановлено",
  error: "Ошибка"
};

export function processStatusLabel(status: string, updatedAt?: Date) {
  if (status === "running" && updatedAt && isStale(updatedAt)) {
    return searchRunStatusLabels.stale;
  }
  return processStatusLabels[status] || searchRunStatusLabels[status] || status;
}

export function searchRunStatusLabel(status: string, updatedAt?: Date) {
  return processStatusLabel(status, updatedAt);
}

export function searchStageLabel(stage?: string | null) {
  if (!stage) return "—";
  return searchStageLabels[stage] || stage;
}

export function isStale(updatedAt: Date, now = Date.now()) {
  return now - updatedAt.getTime() > STALE_AFTER_MS;
}

export function minutesSinceUpdate(updatedAt: Date, now = Date.now()) {
  return Math.floor((now - updatedAt.getTime()) / 60000);
}

export function effectiveSearchRunStatus(status: string, updatedAt: Date) {
  if (status === "running" && isStale(updatedAt)) return "stale";
  return status;
}

export function formatDuration(startedAt: Date, finishedAt?: Date | null) {
  const end = finishedAt ?? new Date();
  const ms = end.getTime() - startedAt.getTime();
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  if (minutes < 1) return `${seconds} сек`;
  return `${minutes} мин ${seconds} сек`;
}
