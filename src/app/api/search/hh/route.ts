import { NextResponse } from "next/server";
import { z } from "zod";
import { collectHhVacancies } from "@/lib/hh-search";
import { prisma } from "@/lib/prisma";
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

export async function POST(request: Request) {
  const body = searchSchema.parse(await request.json());
  const settings = await getUserSettings();
  const profile = await prisma.searchProfile.findUniqueOrThrow({
    where: { id: body.searchProfileId },
    include: { resume: true }
  });

  const run = await prisma.searchRun.create({
    data: {
      searchProfileId: profile.id,
      status: "running",
      queriesJson: JSON.stringify(body.queries, null, 2)
    }
  });

  const errors: string[] = [];
  let totalCreated = 0;
  let totalDuplicates = 0;
  let totalAnalyzed = 0;

  try {
    const collected = await collectHhVacancies({
      queries: body.queries,
      region: body.region,
      limitPerQuery: body.limitPerQuery,
      totalLimit: body.totalLimit,
      onlyWithSalary: body.onlyWithSalary,
      searchPeriodDays: body.searchPeriodDays,
      workFormat: body.workFormat
    });

    errors.push(...collected.errors);
    const newVacancyIds: string[] = [];

    for (const item of collected.vacancies) {
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
          totalDuplicates += 1;
          await prisma.searchRunItem.create({
            data: {
              searchRunId: run.id,
              vacancyId: existing.id,
              sourceUrl: item.sourceUrl,
              status: "duplicate"
            }
          });
          continue;
        }

        const company = await findOrCreateCompany(item.companyName);
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
              item.isArchived ? "archived" : "found"
            ),
            sourceVacancyId: item.sourceVacancyId,
            publishedAtText: item.publishedAtText,
            employerUrl: item.employerUrl,
            isArchived: item.isArchived ?? false
          }
        });

        totalCreated += 1;
        newVacancyIds.push(vacancy.id);
        await prisma.searchRunItem.create({
          data: {
            searchRunId: run.id,
            vacancyId: vacancy.id,
            sourceUrl: item.sourceUrl,
            status: "created"
          }
        });
        await createInteraction({
          vacancyId: vacancy.id,
          companyId: company?.id,
          type: "vacancy_created",
          summary: "Вакансия собрана с hh через браузерный поиск."
        });
      } catch (error) {
        errors.push(`${item.sourceUrl}: ${error instanceof Error ? error.message : "ошибка сохранения"}`);
      }
    }

    if (body.analyzeAfterCollect && settings.aiConfigured) {
      for (const vacancyId of newVacancyIds) {
        try {
          await analyzeStoredVacancy({
            vacancyId,
            resumeId: body.resumeId,
            searchProfileId: profile.id
          });
          totalAnalyzed += 1;
          await prisma.searchRunItem.updateMany({
            where: { searchRunId: run.id, vacancyId },
            data: { status: "analyzed" }
          });
        } catch (error) {
          errors.push(`${vacancyId}: ${error instanceof Error ? error.message : "AI-анализ не удался"}`);
          await prisma.vacancy.update({
            where: { id: vacancyId },
            data: { status: "needs_review" }
          });
          await prisma.searchRunItem.updateMany({
            where: { searchRunId: run.id, vacancyId },
            data: { status: "analysis_error", errorMessage: error instanceof Error ? error.message : "AI-анализ не удался" }
          });
        }
      }
    }

    const finished = await prisma.searchRun.update({
      where: { id: run.id },
      data: {
        status: collected.stoppedByCaptcha ? "stopped" : "completed",
        finishedAt: new Date(),
        totalFound: collected.foundLinks.length,
        totalCreated,
        totalDuplicates,
        totalAnalyzed,
        totalErrors: errors.length,
        errorLogJson: errors.length ? JSON.stringify(errors, null, 2) : null
      }
    });

    return NextResponse.json({
      ok: true,
      run: finished,
      stoppedByCaptcha: collected.stoppedByCaptcha,
      totals: {
        found: collected.foundLinks.length,
        created: totalCreated,
        duplicates: totalDuplicates,
        analyzed: totalAnalyzed,
        errors: errors.length
      },
      errors
    });
  } catch (error) {
    errors.push(error instanceof Error ? error.message : "Поиск не удался.");
    const failed = await prisma.searchRun.update({
      where: { id: run.id },
      data: {
        status: "error",
        finishedAt: new Date(),
        totalCreated,
        totalDuplicates,
        totalAnalyzed,
        totalErrors: errors.length,
        errorLogJson: JSON.stringify(errors, null, 2)
      }
    });

    return NextResponse.json({ ok: false, run: failed, message: errors[0], errors }, { status: 400 });
  }
}
