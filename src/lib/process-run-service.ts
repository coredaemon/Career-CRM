import { type AnalysisMode } from "@/lib/analysis-mode";
import { toJsonText } from "@/lib/json";
import { computeProgressDisplay } from "@/lib/process-status";
import { prisma } from "@/lib/prisma";

export type ProcessRunType =
  | "vacancy_analysis"
  | "cover_letter_generation"
  | "resume_analysis"
  | "pdf_extract"
  | "other";

export type ProcessLogLevel = "info" | "warning" | "error" | "success";

export type ProcessRunItemStatus = "queued" | "running" | "completed" | "error" | "skipped";

export async function createProcessRun(params: {
  type: ProcessRunType;
  title: string;
  description?: string;
  progressTotal?: number;
  analysisMode?: AnalysisMode;
  metadata?: Record<string, unknown>;
}) {
  return prisma.processRun.create({
    data: {
      type: params.type,
      status: "queued",
      title: params.title,
      description: params.description,
      progressTotal: params.progressTotal ?? 0,
      progressCurrent: 0,
      analysisMode: params.analysisMode ?? null,
      metadataJson: params.metadata ? toJsonText(params.metadata) : null
    }
  });
}

export async function createProcessRunItems(
  processRunId: string,
  items: Array<{ vacancyId?: string | null; title: string }>
) {
  if (items.length === 0) return [];
  return prisma.processRunItem.createMany({
    data: items.map((item) => ({
      processRunId,
      vacancyId: item.vacancyId ?? null,
      status: "queued",
      title: item.title
    }))
  });
}

export async function updateProcessRunItem(
  itemId: string,
  params: {
    status: ProcessRunItemStatus;
    errorCode?: string;
    errorMessage?: string;
    startedAt?: Date;
    finishedAt?: Date;
    durationMs?: number;
  }
) {
  return prisma.processRunItem.update({
    where: { id: itemId },
    data: params
  });
}

export async function findProcessRunItem(processRunId: string, vacancyId: string) {
  return prisma.processRunItem.findFirst({
    where: { processRunId, vacancyId }
  });
}

export async function startProcessRun(processRunId: string, currentStep?: string) {
  return prisma.processRun.update({
    where: { id: processRunId },
    data: {
      status: "running",
      currentStep: currentStep ?? "running",
      startedAt: new Date()
    }
  });
}

export async function touchProcessRun(processRunId: string) {
  return prisma.processRun.update({
    where: { id: processRunId },
    data: { updatedAt: new Date() }
  });
}

export async function appendProcessLog(
  processRunId: string,
  level: ProcessLogLevel,
  message: string,
  details?: Record<string, unknown>
) {
  await touchProcessRun(processRunId);
  return prisma.processLog.create({
    data: {
      processRunId,
      level,
      message,
      detailsJson: details ? toJsonText(details) : null
    }
  });
}

export async function updateProcessProgress(
  processRunId: string,
  params: {
    progressCurrent?: number;
    progressTotal?: number;
    currentStep?: string;
    metadata?: Record<string, unknown>;
  }
) {
  const current = await prisma.processRun.findUniqueOrThrow({ where: { id: processRunId } });
  const progressCurrent = params.progressCurrent ?? current.progressCurrent;
  const progressTotal = params.progressTotal ?? current.progressTotal;
  const { progressPercent } = computeProgressDisplay(progressCurrent, progressTotal);

  return prisma.processRun.update({
    where: { id: processRunId },
    data: {
      progressCurrent,
      progressTotal,
      progressPercent,
      currentStep: params.currentStep ?? current.currentStep,
      updatedAt: new Date(),
      metadataJson: params.metadata ? toJsonText({ ...parseMetadata(current.metadataJson), ...params.metadata }) : current.metadataJson
    }
  });
}

export async function finishProcessRun(
  processRunId: string,
  params: {
    status: "completed" | "error" | "stopped" | "stale";
    errorMessage?: string;
    errorCode?: string;
    result?: Record<string, unknown>;
    stoppedReason?: string;
  }
) {
  const logMessage =
    params.status === "completed"
      ? "Процесс завершён."
      : params.status === "error"
        ? params.errorMessage || "Процесс завершился с ошибкой."
        : params.status === "stopped"
          ? "Процесс остановлен пользователем."
          : params.errorMessage || "Процесс остановлен.";

  await appendProcessLog(
    processRunId,
    params.status === "completed" ? "success" : params.status === "error" ? "error" : "warning",
    logMessage
  );

  return prisma.processRun.update({
    where: { id: processRunId },
    data: {
      status: params.status,
      finishedAt: new Date(),
      stoppedAt: params.status === "stopped" ? new Date() : undefined,
      stoppedReason: params.stoppedReason ?? (params.status === "stopped" ? "user" : undefined),
      errorMessage: params.errorMessage,
      errorCode: params.errorCode,
      resultJson: params.result ? toJsonText(params.result) : undefined,
      currentStep: params.status
    }
  });
}

export async function isProcessStopRequested(processRunId: string) {
  const run = await prisma.processRun.findUnique({
    where: { id: processRunId },
    select: { stopRequested: true, metadataJson: true }
  });
  if (!run) return false;
  if (run.stopRequested) return true;
  const metadata = parseMetadata(run.metadataJson);
  return Boolean(metadata.stopRequested);
}

export async function requestProcessStop(processRunId: string) {
  await appendProcessLog(processRunId, "warning", "Остановка запрошена. Завершим после текущего шага.");
  return prisma.processRun.update({
    where: { id: processRunId },
    data: {
      stopRequested: true,
      currentStep: "stopping",
      metadataJson: toJsonText({
        ...parseMetadata(
          (await prisma.processRun.findUnique({ where: { id: processRunId }, select: { metadataJson: true } }))?.metadataJson
        ),
        stopRequested: true,
        stopAfterCurrent: true
      })
    }
  });
}

export async function markProcessRunStopped(processRunId: string, reason: string) {
  return finishProcessRun(processRunId, {
    status: "stopped",
    stoppedReason: reason,
    errorMessage: reason === "marked_stale" ? "Процесс помечен как остановленный (был зависшим)." : undefined
  });
}

function parseMetadata(value: string | null | undefined) {
  if (!value) return {} as Record<string, unknown>;
  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    return {};
  }
}
