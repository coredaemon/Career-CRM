import { prisma } from "@/lib/prisma";
import { vacancyEligibleForBulkWhere } from "@/lib/process-status";

export async function countVacanciesEligibleForBulk() {
  return prisma.vacancy.count({ where: vacancyEligibleForBulkWhere() });
}

export async function findBlockingVacancyAnalysisProcess() {
  return prisma.processRun.findFirst({
    where: { type: "vacancy_analysis", status: { in: ["running", "queued"] }, listHidden: false },
    orderBy: { startedAt: "desc" }
  });
}

export type AiDiagnostics = {
  totalCalls: number;
  retryCount: number;
  invalidJsonCount: number;
  timeoutCount: number;
  durationByRole: Record<string, number>;
  lastCall: {
    provider: string;
    role: string;
    model: string;
    durationMs: number | null;
    createdAt: Date;
  } | null;
  coverLettersCreated: number;
};

export async function aggregateAiDiagnostics(processRunId: string): Promise<AiDiagnostics> {
  const logs = await prisma.aiCallLog.findMany({
    where: { processRunId },
    orderBy: { createdAt: "desc" }
  });

  const durationByRole: Record<string, number> = {};
  let retryCount = 0;
  let invalidJsonCount = 0;
  let timeoutCount = 0;

  for (const log of logs) {
    if ((log.attemptNumber ?? 1) > 1) retryCount += 1;
    if (log.errorCode === "INVALID_AI_JSON") invalidJsonCount += 1;
    if (log.errorCode === "AI_TIMEOUT") timeoutCount += 1;
    if (log.durationMs) {
      durationByRole[log.role] = (durationByRole[log.role] ?? 0) + log.durationMs;
    }
  }

  const last = logs[0];
  const run = await prisma.processRun.findUnique({
    where: { id: processRunId },
    select: { resultJson: true }
  });
  let coverLettersCreated = 0;
  if (run?.resultJson) {
    try {
      const result = JSON.parse(run.resultJson) as { coverLetters?: number };
      coverLettersCreated = result.coverLetters ?? 0;
    } catch {
      coverLettersCreated = 0;
    }
  }

  return {
    totalCalls: logs.length,
    retryCount,
    invalidJsonCount,
    timeoutCount,
    durationByRole,
    lastCall: last
      ? {
          provider: last.provider,
          role: last.role,
          model: last.model,
          durationMs: last.durationMs,
          createdAt: last.createdAt
        }
      : null,
    coverLettersCreated
  };
}
