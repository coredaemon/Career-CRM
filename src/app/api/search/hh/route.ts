import { z } from "zod";
import { AiAnalysisError } from "@/lib/ai-errors";
import { collectHhVacancies, type HhProgressEvent } from "@/lib/hh-search";
import { prisma } from "@/lib/prisma";
import { recalculateSearchRunStats } from "@/lib/search-run-stats";
import { getUserSettings } from "@/lib/settings";
import { analyzeStoredVacancy } from "@/lib/vacancy-ai-workflow";
import { createInteraction, findOrCreateCompany, vacancyCreateData } from "@/lib/vacancy-service";

export const runtime = "nodejs";
export const maxDuration = 300;

const searchSchema = z.object({
  searchProfileId: z.string().min(1),
  resumeId: z.string().min(1),
  queries: z.array(z.string().trim().min(1)).min(1),
  region: z.string().trim().optional().nullable(),
  limitPerQuery: z.number().int().min(1).max(100).default(10),
  totalLimit: z.number().int().min(1).max(200).default(50),
  onlyWithSalary: z.boolean().optional().default(false),
  searchPeriodDays: z.number().int().min(1).max(30).optional().nullable(),
  workFormat: z.string().trim().optional().nullable(),
  analyzeAfterCollect: z.boolean().optional().default(false)
});

type ProgressState = {
  foundLinks: number;
  collectedCards: number;
  created: number;
  duplicates: number;
  analysisQueued: number;
  analyzed: number;
  errors: number;
  recommended: number;
  needsReview: number;
  skippedByAi: number;
  coverLetters: number;
  analysisErrors: number;
};

const initialProgress: ProgressState = {
  foundLinks: 0,
  collectedCards: 0,
  created: 0,
  duplicates: 0,
  analysisQueued: 0,
  analyzed: 0,
  errors: 0,
  recommended: 0,
  needsReview: 0,
  skippedByAi: 0,
  coverLetters: 0,
  analysisErrors: 0
};

export async function POST(request: Request) {
  const body = searchSchema.parse(await request.json());
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const logs: string[] = [];
      const errors: string[] = [];
      const progress: ProgressState = { ...initialProgress };
      let runId = "";

      const send = (event: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      };

      const log = async (message: string, stage?: string) => {
        logs.push(`${new Date().toLocaleTimeString("ru-RU")} · ${message}`);
        send({ type: "log", message, stage, progress });
        if (runId) {
          await prisma.searchRun.update({
            where: { id: runId },
            data: {
              stage,
              progressJson: JSON.stringify(progress),
              logJson: JSON.stringify(logs.slice(-250), null, 2)
            }
          });
        }
      };

      try {
        const settings = await getUserSettings();
        const profile = await prisma.searchProfile.findUniqueOrThrow({
          where: { id: body.searchProfileId },
          include: { resume: true }
        });

        const run = await prisma.searchRun.create({
          data: {
            searchProfileId: profile.id,
            status: "running",
            stage: "preparing",
            totalQueries: body.queries.length,
            queriesJson: JSON.stringify(body.queries, null, 2),
            progressJson: JSON.stringify(progress),
            logJson: JSON.stringify([])
          }
        });
        runId = run.id;
        send({ type: "started", runId, progress });
        await log("Запуск создан. Готовим браузер.", "preparing");

        const handleProgress = async (event: HhProgressEvent) => {
          if (event.type === "query") {
            await prisma.searchRun.update({
              where: { id: runId },
              data: {
                currentQuery: event.query,
                currentQueryIndex: event.queryIndex,
                totalQueries: event.totalQueries,
                stage: "query"
              }
            });
          }
          if (event.type === "links") progress.foundLinks = event.foundLinks;
          if (event.type === "card") progress.collectedCards = Math.max(progress.collectedCards, event.cardIndex);
          if (event.type === "error") {
            progress.errors += 1;
            errors.push(event.message);
          }
          await log(event.message, event.type === "stage" ? event.stage : event.type);
        };

        const collected = await collectHhVacancies({
          queries: body.queries,
          region: body.region,
          limitPerQuery: body.limitPerQuery,
          totalLimit: body.totalLimit,
          onlyWithSalary: body.onlyWithSalary,
          searchPeriodDays: body.searchPeriodDays,
          workFormat: body.workFormat,
          onProgress: handleProgress,
          shouldStop: async () => {
            const current = await prisma.searchRun.findUnique({ where: { id: runId }, select: { stopRequested: true } });
            return Boolean(current?.stopRequested);
          }
        });

        errors.push(...collected.errors.filter((error) => !errors.includes(error)));
        progress.foundLinks = collected.foundLinks.length;

        const newVacancyIds: string[] = [];
        await log("Сохраняем собранные вакансии.", "saving");

        for (const item of collected.vacancies) {
          const current = await prisma.searchRun.findUnique({ where: { id: runId }, select: { stopRequested: true } });
          if (current?.stopRequested) {
            await log("Остановка запрошена пользователем. Завершаем сохранение.", "stopped");
            break;
          }

          try {
            const existing = await prisma.vacancy.findFirst({
              where: {
                OR: [
                  { sourceUrl: item.sourceUrl },
                  item.sourceVacancyId ? { sourceVacancyId: item.sourceVacancyId } : { id: "__never__" }
                ]
              }
            });

            if (existing) {
              progress.duplicates += 1;
              await prisma.searchRunItem.create({
                data: { searchRunId: runId, vacancyId: existing.id, sourceUrl: item.sourceUrl, status: "duplicate" }
              });
              await log(`Дубль пропущен: ${existing.title}`, "saving");
              continue;
            }

            const company = await findOrCreateCompany(item.companyName);
            const weakDescription = !item.rawDescription || item.rawDescription.length < 300;
            const vacancy = await prisma.vacancy.create({
              data: {
                ...vacancyCreateData(
                  {
                    searchProfileId: profile.id,
                    resumeId: body.resumeId,
                    source: "hh",
                    sourceUrl: item.sourceUrl,
                    title: item.title,
                    companyName: item.companyName,
                    salaryText: item.salaryText,
                    location: item.location,
                    workFormat: item.workFormat,
                    rawDescription: item.rawDescription,
                    testRequired: item.testRequired,
                    testStatus: item.testRequired ? "требуется" : "не требуется"
                  },
                  company?.id ?? null,
                  item.isArchived ? "archived" : weakDescription ? "needs_review" : "found"
                ),
                sourceVacancyId: item.sourceVacancyId,
                publishedAtText: item.publishedAtText,
                employerUrl: item.employerUrl,
                isArchived: item.isArchived ?? false,
                recommendation: item.extractionWarning || null
              }
            });

            progress.created += 1;
            newVacancyIds.push(vacancy.id);
            await prisma.searchRunItem.create({
              data: {
                searchRunId: runId,
                vacancyId: vacancy.id,
                sourceUrl: item.sourceUrl,
                status: weakDescription ? "needs_review" : "created",
                errorMessage: item.extractionWarning || null
              }
            });
            await createInteraction({
              vacancyId: vacancy.id,
              companyId: company?.id,
              type: "vacancy_created",
              summary: "Вакансия собрана с hh через браузерный поиск."
            });
            await log(`Сохранили вакансию: ${vacancy.title}`, "saving");
          } catch (error) {
            const message = `${item.sourceUrl}: ${error instanceof Error ? error.message : "ошибка сохранения"}`;
            progress.errors += 1;
            errors.push(message);
            await log(message, "error");
          }
        }

        if (body.analyzeAfterCollect && settings.aiConfigured) {
          progress.analysisQueued = newVacancyIds.length;
          await log(`Запускаем AI-анализ: ${newVacancyIds.length} вакансий.`, "analyzing_ai");
          for (const vacancyId of newVacancyIds) {
            const current = await prisma.searchRun.findUnique({ where: { id: runId }, select: { stopRequested: true } });
            if (current?.stopRequested) {
              await log("Остановка запрошена пользователем. AI-анализ остановлен.", "stopped");
              break;
            }

            const vacancy = await prisma.vacancy.findUnique({ where: { id: vacancyId }, select: { title: true, rawDescription: true } });
            if (!vacancy?.rawDescription || vacancy.rawDescription.length < 300) {
              progress.needsReview += 1;
              await prisma.vacancy.update({
                where: { id: vacancyId },
                data: { status: "needs_review", recommendation: "Не удалось извлечь полный текст вакансии. Проверьте вручную." }
              });
              await log(`AI пропущен: ${vacancy?.title || vacancyId}. Недостаточно текста вакансии.`, "analyzing_ai");
              continue;
            }

            try {
              await log(`Запускаем AI-анализ: ${vacancy.title}`, "analyzing_ai");
              const result = await analyzeStoredVacancy({
                vacancyId,
                resumeId: body.resumeId,
                searchProfileId: profile.id,
                mode: "fast"
              });
              progress.analyzed += 1;
              if (result.coverLetterCreated) progress.coverLetters += 1;
              if (result.vacancy.status === "ready_to_apply" || result.vacancy.status === "ai_recommended") progress.recommended += 1;
              if (result.vacancy.status === "needs_review") progress.needsReview += 1;
              if (result.vacancy.status === "rejected_by_ai") progress.skippedByAi += 1;
              await prisma.searchRunItem.updateMany({ where: { searchRunId: runId, vacancyId }, data: { status: "analyzed" } });
              await log(`AI-анализ завершён: ${vacancy.title}`, "analyzing_ai");
              if (result.coverLetterCreated) {
                await log(`Сопроводительное создано: ${vacancy.title}`, "analyzing_ai");
              }
            } catch (error) {
              const isInvalidJson = error instanceof AiAnalysisError && error.code === "INVALID_AI_JSON";
              const message = isInvalidJson
                ? `${vacancy?.title || vacancyId}: ${error.userMessage}`
                : `${vacancy?.title || vacancyId}: ${error instanceof Error ? error.message : "AI-анализ не удался"}`;
              progress.errors += 1;
              progress.analysisErrors += 1;
              errors.push(message);
              await prisma.vacancy.update({
                where: { id: vacancyId },
                data: {
                  status: "analysis_error",
                  recommendation: message,
                  analysisErrorCode: isInvalidJson ? "INVALID_AI_JSON" : "AI_ANALYSIS_FAILED",
                  analysisErrorMessage: isInvalidJson ? error.userMessage : message
                }
              });
              await prisma.searchRunItem.updateMany({
                where: { searchRunId: runId, vacancyId },
                data: {
                  status: "analysis_error",
                  errorCode: isInvalidJson ? "INVALID_AI_JSON" : "AI_ANALYSIS_FAILED",
                  errorMessage: message
                }
              });
              await log(isInvalidJson ? `Ошибка анализа: модель вернула невалидный JSON — ${vacancy?.title}` : message, "error");
            }
          }
        } else if (body.analyzeAfterCollect && !settings.aiConfigured) {
          await log("AI-анализ включён, но настройки AI не сохранены. Вакансии сохранены без анализа.", "error");
        }

        const current = await prisma.searchRun.findUnique({ where: { id: runId }, select: { stopRequested: true } });
        const finalStatus = current?.stopRequested || collected.stoppedByUser || collected.stoppedByCaptcha ? "stopped" : "completed";
        const finished = await prisma.searchRun.update({
          where: { id: runId },
          data: {
            status: finalStatus,
            stage: finalStatus === "completed" ? "completed" : "stopped",
            finishedAt: new Date(),
            totalFound: progress.foundLinks,
            totalCreated: progress.created,
            totalDuplicates: progress.duplicates,
            totalAnalyzed: progress.analyzed,
            totalErrors: progress.errors,
            progressJson: JSON.stringify(progress),
            logJson: JSON.stringify(logs.slice(-250), null, 2),
            errorLogJson: errors.length ? JSON.stringify(errors, null, 2) : null
          }
        });

        if (runId) {
          await recalculateSearchRunStats(runId);
        }

        await log(finalStatus === "completed" ? "Поиск завершён." : "Поиск остановлен.", finalStatus);
        const refreshed = runId ? await prisma.searchRun.findUnique({ where: { id: runId } }) : finished;
        send({ type: "done", run: refreshed ?? finished, progress, errors, stoppedByCaptcha: collected.stoppedByCaptcha });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Поиск не удался.";
        errors.push(message);
        progress.errors += 1;
        if (runId) {
          await prisma.searchRun.update({
            where: { id: runId },
            data: {
              status: "error",
              stage: "error",
              finishedAt: new Date(),
              errorMessage: message,
              totalErrors: progress.errors,
              progressJson: JSON.stringify(progress),
              logJson: JSON.stringify(logs.slice(-250), null, 2),
              errorLogJson: JSON.stringify(errors, null, 2)
            }
          });
          await recalculateSearchRunStats(runId);
        }
        send({ type: "error", message, progress, errors });
      } finally {
        if (runId) {
          try {
            await recalculateSearchRunStats(runId);
          } catch {
            // ignore if run was not created
          }
        }
        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache"
    }
  });
}
