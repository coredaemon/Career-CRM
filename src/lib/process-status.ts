export const STALE_AFTER_MS = 10 * 60 * 1000;
export const AI_TIMEOUT_MS = 90_000;

type AnalysisMode = "fast" | "full" | "letters_only";

const analysisModeLabels: Record<AnalysisMode, string> = {
  fast: "Быстрый анализ",
  full: "Полный анализ",
  letters_only: "Только письма для рекомендованных"
};

export type ProcessStatus =
  | "queued"
  | "running"
  | "stopping"
  | "completed"
  | "error"
  | "stopped"
  | "stale";

export const processStatusLabels: Record<string, string> = {
  queued: "В очереди",
  running: "Выполняется",
  stopping: "Останавливается…",
  completed: "Завершён",
  error: "Ошибка",
  stopped: "Остановлен",
  stale: "Завис"
};

export const searchRunStatusLabels: Record<string, string> = processStatusLabels;

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
  error: "Ошибка",
  stale: "Завис"
};

export type NormalizedProcessState = {
  id: string;
  type: string;
  status: ProcessStatus | string;
  title: string;
  progressCurrent: number;
  progressTotal: number;
  progressPercent: number | null;
  displayCurrent: number;
  displayTotal: number;
  currentStep: string | null;
  startedAt: Date;
  updatedAt: Date;
  finishedAt: Date | null;
  durationSeconds: number;
  stale: boolean;
  canStop: boolean;
  canRetry: boolean;
  canMarkStopped: boolean;
  stats: Record<string, unknown>;
  lastLogs: Array<{ level: string; message: string; createdAt: Date }>;
  humanStatusLabel: string;
  humanSummary: string;
  etaSeconds: number | null;
  avgSecondsPerItem: number | null;
  elapsedLabel: string;
  etaLabel: string;
  analysisMode?: AnalysisMode | null;
  href: string;
};

export function isStale(updatedAt: Date, now = Date.now()) {
  return now - updatedAt.getTime() > STALE_AFTER_MS;
}

export function minutesSinceUpdate(updatedAt: Date, now = Date.now()) {
  return Math.floor((now - updatedAt.getTime()) / 60000);
}

export function effectiveProcessStatus(
  dbStatus: string,
  updatedAt: Date,
  stopRequested = false
): ProcessStatus | string {
  if (dbStatus === "running" && stopRequested) return "stopping";
  if (dbStatus === "running" && isStale(updatedAt)) return "stale";
  return dbStatus;
}

export function effectiveSearchRunStatus(status: string, updatedAt: Date, stopRequested = false) {
  return effectiveProcessStatus(status, updatedAt, stopRequested);
}

export function processStatusLabel(status: string, updatedAt?: Date, stopRequested = false) {
  const effective = updatedAt ? effectiveProcessStatus(status, updatedAt, stopRequested) : status;
  return processStatusLabels[effective] || processStatusLabels[status] || status;
}

export function searchRunStatusLabel(status: string, updatedAt?: Date, stopRequested = false) {
  return processStatusLabel(status, updatedAt, stopRequested);
}

export function searchStageLabel(stage?: string | null) {
  if (!stage) return "—";
  return searchStageLabels[stage] || stage;
}

export function formatDuration(startedAt: Date, finishedAt?: Date | null) {
  const end = finishedAt ?? new Date();
  const ms = end.getTime() - startedAt.getTime();
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  if (minutes < 1) return `${seconds} сек`;
  return `${minutes} мин ${seconds} сек`;
}

export function computeProgressDisplay(processed: number, total: number) {
  const displayTotal = Math.max(total, 0);
  const displayCurrent = displayTotal > 0 ? Math.min(Math.max(processed, 0), displayTotal) : 0;
  const progressPercent = displayTotal > 0 ? Math.min(100, Math.round((displayCurrent / displayTotal) * 100)) : null;
  return { displayCurrent, displayTotal, progressPercent };
}

export function computeEta(processed: number, total: number, startedAt: Date, finishedAt?: Date | null) {
  const { displayCurrent, displayTotal } = computeProgressDisplay(processed, total);
  const end = finishedAt ?? new Date();
  const elapsedMs = end.getTime() - startedAt.getTime();
  const elapsedSeconds = Math.max(0, Math.floor(elapsedMs / 1000));

  if (displayCurrent < 2 || displayTotal <= displayCurrent) {
    return {
      elapsedSeconds,
      avgSecondsPerItem: null as number | null,
      etaSeconds: null as number | null,
      elapsedLabel: formatDuration(startedAt, finishedAt),
      etaLabel: finishedAt ? "—" : "Оцениваем скорость…"
    };
  }

  const avgSecondsPerItem = elapsedSeconds / displayCurrent;
  const remaining = displayTotal - displayCurrent;
  const etaSeconds = Math.round(avgSecondsPerItem * remaining);

  return {
    elapsedSeconds,
    avgSecondsPerItem: Math.round(avgSecondsPerItem),
    etaSeconds,
    elapsedLabel: formatDuration(startedAt, finishedAt),
    etaLabel: finishedAt
      ? "—"
      : `Осталось примерно: ${Math.floor(etaSeconds / 60)} мин ${etaSeconds % 60} сек`
  };
}

export function vacancyEligibleForBulkWhere() {
  return {
    searchProfileId: { not: null },
    status: { notIn: ["invalid_source", "skipped_invalid", "archived", "applied"] },
    OR: [{ matchScore: null }, { aiAnalysisJson: null }, { status: "analysis_error" as const }]
  };
}

type ProcessRunInput = {
  id: string;
  type: string;
  status: string;
  title: string;
  progressCurrent: number;
  progressTotal: number;
  progressPercent?: number | null;
  currentStep?: string | null;
  startedAt: Date;
  updatedAt: Date;
  finishedAt?: Date | null;
  stopRequested?: boolean;
  analysisMode?: string | null;
  errorMessage?: string | null;
  resultJson?: string | null;
};

export function buildProcessRunUiState(
  run: ProcessRunInput,
  options?: {
    logs?: Array<{ level: string; message: string; createdAt: Date }>;
    stats?: Record<string, unknown>;
    diagnostics?: Record<string, unknown>;
  }
): NormalizedProcessState {
  const effective = effectiveProcessStatus(run.status, run.updatedAt, run.stopRequested);
  const stale = effective === "stale";
  const { displayCurrent, displayTotal, progressPercent } = computeProgressDisplay(run.progressCurrent, run.progressTotal);
  const eta = computeEta(run.progressCurrent, run.progressTotal, run.startedAt, run.finishedAt);
  const mode = (run.analysisMode as AnalysisMode) || null;

  const humanStatusLabel = processStatusLabel(run.status, run.updatedAt, run.stopRequested);
  let humanSummary = `${humanStatusLabel}`;
  if (displayTotal > 0 && (effective === "running" || effective === "stopping" || effective === "queued")) {
    humanSummary = `AI анализирует ${displayCurrent} из ${displayTotal}`;
    if (mode) humanSummary += ` · ${analysisModeLabels[mode]}`;
  } else if (displayTotal > 0) {
    humanSummary = `${humanStatusLabel}: ${displayCurrent} из ${displayTotal}`;
  }

  const canStop = run.status === "running" || run.status === "queued";
  const canMarkStopped = run.status === "stale";
  const canRetry = run.status === "error" || run.status === "stopped";

  return {
    id: run.id,
    type: run.type,
    status: effective,
    title: run.title,
    progressCurrent: run.progressCurrent,
    progressTotal: run.progressTotal,
    progressPercent: progressPercent ?? run.progressPercent ?? null,
    displayCurrent,
    displayTotal,
    currentStep: run.currentStep ?? null,
    startedAt: run.startedAt,
    updatedAt: run.updatedAt,
    finishedAt: run.finishedAt ?? null,
    durationSeconds: eta.elapsedSeconds,
    stale,
    canStop,
    canRetry,
    canMarkStopped,
    stats: {
      ...(options?.stats ?? {}),
      diagnostics: options?.diagnostics
    },
    lastLogs: options?.logs?.slice(-20) ?? [],
    humanStatusLabel,
    humanSummary,
    etaSeconds: eta.etaSeconds,
    avgSecondsPerItem: eta.avgSecondsPerItem,
    elapsedLabel: eta.elapsedLabel,
    etaLabel: eta.etaLabel,
    analysisMode: mode,
    href: `/processes/${run.id}`
  };
}

type SearchRunInput = {
  id: string;
  status: string;
  stopRequested?: boolean;
  stage?: string | null;
  startedAt: Date;
  updatedAt: Date;
  finishedAt?: Date | null;
  progressJson?: string | null;
  searchProfileTitle?: string | null;
  totalQueries?: number | null;
  currentQueryIndex?: number | null;
};

export function buildSearchRunUiState(
  run: SearchRunInput,
  options?: {
    progress?: Record<string, unknown>;
    logs?: Array<{ level: string; message: string; createdAt: Date }>;
  }
): NormalizedProcessState {
  const progress = options?.progress ?? {};
  const analyzed = Number(progress.analyzed ?? 0);
  const analysisQueued = Number(progress.analysisQueued ?? 0);
  const queryIndex = run.currentQueryIndex ?? 0;
  const totalQueries = run.totalQueries ?? 0;

  let progressCurrent = queryIndex;
  let progressTotal = totalQueries;
  const stage = run.stage ?? "";
  if (stage === "analyzing_ai" || analysisQueued > 0) {
    progressCurrent = analyzed;
    progressTotal = analysisQueued > 0 ? analysisQueued : progressTotal;
  }

  const effective = effectiveSearchRunStatus(run.status, run.updatedAt, run.stopRequested);
  const { displayCurrent, displayTotal, progressPercent } = computeProgressDisplay(progressCurrent, progressTotal);
  const eta = computeEta(progressCurrent, progressTotal, run.startedAt, run.finishedAt);

  const title = run.searchProfileTitle || "Поиск вакансий";
  const humanStatusLabel = searchRunStatusLabel(run.status, run.updatedAt, run.stopRequested);
  let humanSummary = humanStatusLabel;
  if (effective === "running" || effective === "stopping") {
    if (stage === "analyzing_ai" && displayTotal > 0) {
      humanSummary = `AI после поиска: ${displayCurrent} из ${displayTotal}`;
    } else if (displayTotal > 0) {
      humanSummary = `Поиск: запрос ${displayCurrent} из ${displayTotal}`;
    } else {
      humanSummary = `Идёт поиск: ${title}`;
    }
  }

  return {
    id: run.id,
    type: "search",
    status: effective,
    title,
    progressCurrent,
    progressTotal,
    progressPercent,
    displayCurrent,
    displayTotal,
    currentStep: run.stage ?? null,
    startedAt: run.startedAt,
    updatedAt: run.updatedAt,
    finishedAt: run.finishedAt ?? null,
    durationSeconds: eta.elapsedSeconds,
    stale: effective === "stale",
    canStop: run.status === "running",
    canRetry: run.status === "error" || run.status === "stopped",
    canMarkStopped: run.status === "stale",
    stats: { progress },
    lastLogs: options?.logs?.slice(-20) ?? [],
    humanStatusLabel,
    humanSummary,
    etaSeconds: eta.etaSeconds,
    avgSecondsPerItem: eta.avgSecondsPerItem,
    elapsedLabel: eta.elapsedLabel,
    etaLabel: eta.etaLabel,
    href: `/search/runs/${run.id}`
  };
}
