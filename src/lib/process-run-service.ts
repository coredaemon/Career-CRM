import { toJsonText } from "@/lib/json";
import { prisma } from "@/lib/prisma";

export type ProcessRunType =
  | "vacancy_analysis"
  | "cover_letter_generation"
  | "resume_analysis"
  | "pdf_extract"
  | "other";

export type ProcessLogLevel = "info" | "warning" | "error" | "success";

export async function createProcessRun(params: {
  type: ProcessRunType;
  title: string;
  description?: string;
  progressTotal?: number;
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
      metadataJson: params.metadata ? toJsonText(params.metadata) : null
    }
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

export async function appendProcessLog(
  processRunId: string,
  level: ProcessLogLevel,
  message: string,
  details?: Record<string, unknown>
) {
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
  const progressPercent =
    progressTotal > 0 ? Math.min(100, Math.round((progressCurrent / progressTotal) * 100)) : null;

  return prisma.processRun.update({
    where: { id: processRunId },
    data: {
      progressCurrent,
      progressTotal,
      progressPercent,
      currentStep: params.currentStep ?? current.currentStep,
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
  }
) {
  await appendProcessLog(
    processRunId,
    params.status === "completed" ? "success" : params.status === "error" ? "error" : "warning",
    params.errorMessage || (params.status === "completed" ? "Процесс завершён." : "Процесс остановлен.")
  );

  return prisma.processRun.update({
    where: { id: processRunId },
    data: {
      status: params.status,
      finishedAt: new Date(),
      errorMessage: params.errorMessage,
      errorCode: params.errorCode,
      resultJson: params.result ? toJsonText(params.result) : undefined
    }
  });
}

export async function isProcessStopRequested(processRunId: string) {
  const run = await prisma.processRun.findUnique({ where: { id: processRunId }, select: { metadataJson: true } });
  const metadata = parseMetadata(run?.metadataJson);
  return Boolean(metadata.stopRequested);
}

export async function requestProcessStop(processRunId: string) {
  const run = await prisma.processRun.findUniqueOrThrow({ where: { id: processRunId } });
  const metadata = { ...parseMetadata(run.metadataJson), stopRequested: true, stopAfterCurrent: true };
  await appendProcessLog(processRunId, "warning", "Остановка запрошена. Завершим после текущего шага.");
  return prisma.processRun.update({
    where: { id: processRunId },
    data: { metadataJson: toJsonText(metadata), currentStep: "stopping" }
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
