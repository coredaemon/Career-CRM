import { NextResponse } from "next/server";
import { z } from "zod";
import { analysisModeLabels, parseAnalysisMode, type AnalysisMode } from "@/lib/analysis-mode";
import { AiAnalysisError } from "@/lib/ai-errors";
import { prisma } from "@/lib/prisma";
import { createProcessAbortController, clearProcessAbortController } from "@/lib/process-abort-registry";
import { findBlockingVacancyAnalysisProcess } from "@/lib/process-queries";
import { buildProcessRunUiState, vacancyEligibleForBulkWhere } from "@/lib/process-status";
import {
  appendProcessLog,
  createProcessRun,
  createProcessRunItems,
  finishProcessRun,
  findProcessRunItem,
  isProcessStopRequested,
  startProcessRun,
  updateProcessProgress,
  updateProcessRunItem
} from "@/lib/process-run-service";
import { getUserSettings } from "@/lib/settings";
import { isVacancyValidForAnalysis } from "@/lib/vacancy-analysis-eligibility";
import { analyzeStoredVacancy } from "@/lib/vacancy-ai-workflow";

const bulkSchema = z.object({
  vacancyIds: z.array(z.string()).optional(),
  limit: z.number().int().min(1).max(50).default(20),
  retryErrorsOnly: z.boolean().optional().default(false),
  analysisMode: z.enum(["fast", "full", "letters_only"]).optional().default("fast"),
  force: z.boolean().optional().default(false)
});

export const runtime = "nodejs";
export const maxDuration = 300;

function logPrefix(index: number, total: number) {
  return `[${index + 1}/${total}]`;
}

type BulkVacancy = {
  id: string;
  title: string;
  source: string;
  sourceUrl: string | null;
  sourceVacancyId: string | null;
  rawDescription: string | null;
  searchProfileId: string | null;
  status: string;
  searchProfile: { resumeId: string } | null;
  company: { name: string | null } | null;
};

async function runBulkAnalysis(processId: string, mode: AnalysisMode, vacancies: BulkVacancy[]) {
  const signal = createProcessAbortController(processId);
  let analyzed = 0;
  let skipped = 0;
  let errors = 0;
  let coverLetters = 0;
  let recommended = 0;
  const errorMessages: string[] = [];
  const total = vacancies.length;

  try {
    let processed = 0;

    for (let index = 0; index < vacancies.length; index += 1) {
      const vacancy = vacancies[index];
      if (await isProcessStopRequested(processId)) {
        await appendProcessLog(processId, "warning", "Остановка после текущей вакансии.");
        break;
      }

      const item = await findProcessRunItem(processId, vacancy.id);
      const itemId = item?.id;

      await updateProcessProgress(processId, {
        progressCurrent: processed,
        progressTotal: total,
        currentStep: `analyzing:${vacancy.title}`
      });

      const finishItem = async (params: {
        status: "completed" | "error" | "skipped";
        errorCode?: string;
        errorMessage?: string;
        startedAt: Date;
      }) => {
        if (itemId) {
          const finishedAt = new Date();
          await updateProcessRunItem(itemId, {
            status: params.status,
            errorCode: params.errorCode,
            errorMessage: params.errorMessage,
            startedAt: params.startedAt,
            finishedAt,
            durationMs: finishedAt.getTime() - params.startedAt.getTime()
          });
        }
        processed += 1;
        await updateProcessProgress(processId, {
          progressCurrent: processed,
          progressTotal: total
        });
      };

      const startedAt = new Date();
      if (itemId) {
        await updateProcessRunItem(itemId, { status: "running", startedAt });
      }

      if (!vacancy.searchProfile?.resumeId) {
        skipped += 1;
        await appendProcessLog(processId, "warning", `${logPrefix(index, total)} Пропущено: ${vacancy.title} — нет профиля поиска.`);
        await finishItem({ status: "skipped", startedAt });
        continue;
      }

      if (mode !== "letters_only") {
        const validation = isVacancyValidForAnalysis(vacancy);
        if (!validation.ok) {
          skipped += 1;
          await prisma.vacancy.update({
            where: { id: vacancy.id },
            data: {
              status: "invalid_source",
              analysisErrorCode: "INVALID_VACANCY_SOURCE",
              analysisErrorMessage: "Это не похоже на страницу вакансии. AI-анализ не запускался."
            }
          });
          await appendProcessLog(
            processId,
            "warning",
            `${logPrefix(index, total)} Пропущено: невалидная вакансия — ${validation.reason || "не похоже на вакансию"}.`
          );
          await finishItem({
            status: "skipped",
            errorCode: validation.code || "INVALID_VACANCY_SOURCE",
            errorMessage: validation.reason,
            startedAt
          });
          continue;
        }
      }

      if (mode === "letters_only") {
        const eligible =
          (vacancy.status === "ai_recommended" || vacancy.status === "ready_to_apply") && vacancy.searchProfile?.resumeId;
        if (!eligible) {
          skipped += 1;
          await appendProcessLog(processId, "warning", `${logPrefix(index, total)} Пропущено: ${vacancy.title} — не рекомендована.`);
          await finishItem({ status: "skipped", startedAt });
          continue;
        }
      }

      try {
        await appendProcessLog(processId, "info", `${logPrefix(index, total)} Анализируем: ${vacancy.title}`);
        const result = await analyzeStoredVacancy({
          vacancyId: vacancy.id,
          resumeId: vacancy.searchProfile.resumeId,
          searchProfileId: vacancy.searchProfileId,
          mode,
          processRunId: processId,
          signal,
          onLog: async (message) => {
            await appendProcessLog(processId, "info", `${logPrefix(index, total)} ${message}`);
          }
        });
        analyzed += 1;
        if (result.coverLetterCreated) coverLetters += 1;
        if (result.vacancy.status === "ready_to_apply" || result.vacancy.status === "ai_recommended") recommended += 1;
        await appendProcessLog(
          processId,
          "success",
          `${logPrefix(index, total)} Анализ завершён, score ${Math.round(result.analysis.vacancy_match_score)}.${result.coverLetterCreated ? " Письмо создано." : ""}`
        );
        await finishItem({ status: "completed", startedAt });
      } catch (error) {
        const code = error instanceof AiAnalysisError ? error.code : "AI_ANALYSIS_FAILED";
        const message =
          error instanceof AiAnalysisError
            ? error.userMessage
            : error instanceof Error
              ? error.message
              : "AI-анализ не удался";

        if (code === "INVALID_VACANCY_SOURCE") {
          skipped += 1;
          await appendProcessLog(processId, "warning", `${logPrefix(index, total)} Пропущено: невалидная вакансия.`);
          await finishItem({ status: "skipped", errorCode: code, errorMessage: message, startedAt });
          continue;
        }

        errors += 1;
        errorMessages.push(`${vacancy.title}: ${message}`);
        const detail =
          code === "INVALID_AI_JSON"
            ? "модель не вернула валидный JSON (repair/fallback не помогли)"
            : code === "AI_TIMEOUT"
              ? "превышен таймаут AI"
              : code === "ABORTED_BY_USER"
                ? "прервано пользователем"
                : message;
        await appendProcessLog(processId, "error", `${logPrefix(index, total)} Ошибка: ${detail}.`, { code, message });
        await finishItem({ status: "error", errorCode: code, errorMessage: message, startedAt });
      }
    }

    const stopped = await isProcessStopRequested(processId);
    const [recommendedCount, readyToApply, needsReview] = await Promise.all([
      prisma.vacancy.count({ where: { status: "ai_recommended" } }),
      prisma.vacancy.count({ where: { status: "ready_to_apply" } }),
      prisma.vacancy.count({ where: { status: "needs_review" } })
    ]);

    await finishProcessRun(processId, {
      status: stopped ? "stopped" : errors > 0 && analyzed === 0 ? "error" : "completed",
      stoppedReason: stopped ? "user" : undefined,
      errorMessage: errors > 0 && !stopped ? `Ошибок анализа: ${errors}` : undefined,
      result: {
        analyzed,
        skipped,
        errors: errorMessages,
        errorCount: errors,
        coverLetters,
        recommended,
        recommendedCount,
        readyToApply,
        needsReview,
        analysisMode: mode
      }
    });
    clearProcessAbortController(processId);
  } catch (error) {
    clearProcessAbortController(processId);
    await finishProcessRun(processId, {
      status: "error",
      errorMessage: error instanceof Error ? error.message : "Массовый AI-анализ не удался."
    });
  }
}

function bulkWhere(body: z.infer<typeof bulkSchema>) {
  if (body.vacancyIds?.length) return { id: { in: body.vacancyIds } };
  if (body.retryErrorsOnly) {
    return { status: "analysis_error", searchProfileId: { not: null } };
  }
  if (body.analysisMode === "letters_only") {
    return {
      status: { in: ["ai_recommended", "ready_to_apply"] },
      searchProfileId: { not: null },
      coverLetters: { none: {} }
    };
  }
  return vacancyEligibleForBulkWhere();
}

export async function POST(request: Request) {
  try {
    const body = bulkSchema.parse(await request.json().catch(() => ({})));
    const mode = parseAnalysisMode(body.analysisMode);
    const settings = await getUserSettings();
    if (!settings.aiConfigured) {
      return NextResponse.json({ ok: false, message: "Сначала сохраните настройки AI." }, { status: 400 });
    }

    if (!body.force) {
      const active = await findBlockingVacancyAnalysisProcess();
      if (active) {
        const state = buildProcessRunUiState(active);
        return NextResponse.json(
          {
            ok: false,
            code: "PROCESS_ALREADY_RUNNING",
            message: `AI-анализ уже выполняется: ${state.displayCurrent} из ${state.displayTotal}`,
            activeProcessRunId: active.id,
            state
          },
          { status: 409 }
        );
      }
    }

    const candidates = await prisma.vacancy.findMany({
      where: bulkWhere(body),
      take: Math.min(body.limit * 3, 50),
      orderBy: { createdAt: "asc" },
      include: { searchProfile: true, company: true }
    });

    const validVacancies: BulkVacancy[] = [];
    let invalidCount = 0;

    for (const vacancy of candidates) {
      if (validVacancies.length >= body.limit) break;
      if (mode !== "letters_only") {
        const validation = isVacancyValidForAnalysis(vacancy);
        if (!validation.ok) {
          invalidCount += 1;
          continue;
        }
      }
      validVacancies.push(vacancy);
    }

    const title =
      mode === "letters_only"
        ? "Создание писем для рекомендованных"
        : body.retryErrorsOnly
          ? "Повтор ошибок AI-анализа"
          : "Массовый AI-анализ вакансий";

    const process = await createProcessRun({
      type: "vacancy_analysis",
      title,
      description: `К AI-анализу: ${validVacancies.length}`,
      progressTotal: validVacancies.length,
      analysisMode: mode,
      metadata: { retryErrorsOnly: body.retryErrorsOnly, analysisMode: mode, selected: candidates.length, invalid: invalidCount }
    });

    await createProcessRunItems(
      process.id,
      validVacancies.map((v) => ({ vacancyId: v.id, title: v.title }))
    );

    await startProcessRun(process.id, "preparing");
    await appendProcessLog(process.id, "info", `Выбрано ${candidates.length} вакансий.`);
    if (invalidCount > 0) {
      await appendProcessLog(process.id, "warning", `Пропущено ${invalidCount} невалидные.`);
    }
    await appendProcessLog(
      process.id,
      "info",
      `К AI-анализу отправлено ${validVacancies.length}, режим ${analysisModeLabels[mode]}.`
    );

    void runBulkAnalysis(process.id, mode, validVacancies);

    return NextResponse.json({
      ok: true,
      processRunId: process.id,
      total: validVacancies.length,
      selected: candidates.length,
      skippedInvalid: invalidCount,
      analysisMode: mode
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "Не удалось запустить массовый AI-анализ." },
      { status: 400 }
    );
  }
}
