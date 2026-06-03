import { NextResponse } from "next/server";
import { z } from "zod";
import { AiAnalysisError } from "@/lib/ai-errors";
import { prisma } from "@/lib/prisma";
import {
  appendProcessLog,
  createProcessRun,
  finishProcessRun,
  isProcessStopRequested,
  startProcessRun,
  updateProcessProgress
} from "@/lib/process-run-service";
import { getUserSettings } from "@/lib/settings";
import { analyzeStoredVacancy } from "@/lib/vacancy-ai-workflow";

const bulkSchema = z.object({
  vacancyIds: z.array(z.string()).optional(),
  limit: z.number().int().min(1).max(50).default(20),
  retryErrorsOnly: z.boolean().optional().default(false)
});

export const runtime = "nodejs";
export const maxDuration = 300;

async function runBulkAnalysis(
  processId: string,
  vacancies: Array<{
    id: string;
    title: string;
    rawDescription: string | null;
    searchProfileId: string | null;
    searchProfile: { resumeId: string } | null;
  }>
) {
  let analyzed = 0;
  let skipped = 0;
  let errors = 0;
  let coverLetters = 0;
  let recommended = 0;
  const errorMessages: string[] = [];

  try {
    for (let index = 0; index < vacancies.length; index += 1) {
      const vacancy = vacancies[index];
      if (await isProcessStopRequested(processId)) {
        await appendProcessLog(processId, "warning", "Остановка после текущей вакансии.");
        break;
      }

      await updateProcessProgress(processId, {
        progressCurrent: index,
        progressTotal: vacancies.length,
        currentStep: `analyzing:${vacancy.title}`
      });

      if (!vacancy.searchProfile?.resumeId) {
        skipped += 1;
        await appendProcessLog(processId, "warning", `Пропущено: ${vacancy.title} — нет профиля поиска.`);
        continue;
      }

      if (!vacancy.rawDescription || vacancy.rawDescription.length < 300) {
        skipped += 1;
        await prisma.vacancy.update({
          where: { id: vacancy.id },
          data: { status: "needs_review", recommendation: "Не удалось извлечь полный текст вакансии. Проверьте вручную." }
        });
        await appendProcessLog(processId, "warning", `Пропущено: ${vacancy.title} — недостаточно текста.`);
        continue;
      }

      try {
        await appendProcessLog(processId, "info", `AI анализирует (${index + 1}/${vacancies.length}): ${vacancy.title}`);
        const result = await analyzeStoredVacancy({
          vacancyId: vacancy.id,
          resumeId: vacancy.searchProfile.resumeId,
          searchProfileId: vacancy.searchProfileId
        });
        analyzed += 1;
        coverLetters += 1;
        if (result.vacancy.status === "ready_to_apply" || result.vacancy.status === "ai_recommended") recommended += 1;
        await appendProcessLog(processId, "success", `AI-анализ завершён: ${vacancy.title}`);
      } catch (error) {
        errors += 1;
        const message =
          error instanceof AiAnalysisError
            ? error.userMessage
            : error instanceof Error
              ? error.message
              : "AI-анализ не удался";
        errorMessages.push(`${vacancy.title}: ${message}`);
        await appendProcessLog(processId, "error", `Ошибка анализа: ${vacancy.title}`, {
          code: error instanceof AiAnalysisError ? error.code : "AI_ANALYSIS_FAILED",
          message
        });
      }

      await updateProcessProgress(processId, {
        progressCurrent: index + 1,
        progressTotal: vacancies.length
      });
    }

    const stopped = await isProcessStopRequested(processId);
    const [recommendedCount, readyToApply, needsReview] = await Promise.all([
      prisma.vacancy.count({ where: { status: "ai_recommended" } }),
      prisma.vacancy.count({ where: { status: "ready_to_apply" } }),
      prisma.vacancy.count({ where: { status: "needs_review" } })
    ]);

    await finishProcessRun(processId, {
      status: stopped ? "stopped" : errors > 0 && analyzed === 0 ? "error" : "completed",
      errorMessage: errors > 0 ? `Ошибок анализа: ${errors}` : undefined,
      result: {
        analyzed,
        skipped,
        errors: errorMessages,
        errorCount: errors,
        coverLetters,
        recommended,
        recommendedCount,
        readyToApply,
        needsReview
      }
    });
  } catch (error) {
    await finishProcessRun(processId, {
      status: "error",
      errorMessage: error instanceof Error ? error.message : "Массовый AI-анализ не удался."
    });
  }
}

export async function POST(request: Request) {
  try {
    const body = bulkSchema.parse(await request.json().catch(() => ({})));
    const settings = await getUserSettings();
    if (!settings.aiConfigured) {
      return NextResponse.json({ ok: false, message: "Сначала сохраните настройки AI." }, { status: 400 });
    }

    const vacancies = await prisma.vacancy.findMany({
      where: body.vacancyIds?.length
        ? { id: { in: body.vacancyIds } }
        : body.retryErrorsOnly
          ? { status: "analysis_error" }
          : {
              OR: [{ matchScore: null }, { aiAnalysisJson: null }, { status: "analysis_error" }],
              searchProfileId: { not: null }
            },
      take: body.limit,
      orderBy: { createdAt: "asc" },
      include: { searchProfile: true }
    });

    const process = await createProcessRun({
      type: "vacancy_analysis",
      title: body.retryErrorsOnly ? "Повтор ошибок AI-анализа" : "Массовый AI-анализ вакансий",
      description: `Выбрано вакансий: ${vacancies.length}`,
      progressTotal: vacancies.length,
      metadata: { retryErrorsOnly: body.retryErrorsOnly }
    });

    await startProcessRun(process.id, "preparing");
    await appendProcessLog(process.id, "info", `Запуск AI-анализа: ${vacancies.length} вакансий.`);

    void runBulkAnalysis(process.id, vacancies);

    return NextResponse.json({
      ok: true,
      processRunId: process.id,
      total: vacancies.length
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "Не удалось запустить массовый AI-анализ." },
      { status: 400 }
    );
  }
}
