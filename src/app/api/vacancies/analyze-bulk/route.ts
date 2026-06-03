import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getUserSettings } from "@/lib/settings";
import { analyzeStoredVacancy } from "@/lib/vacancy-ai-workflow";

const bulkSchema = z.object({
  vacancyIds: z.array(z.string()).optional(),
  limit: z.number().int().min(1).max(50).default(20)
});

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
        : {
            OR: [{ matchScore: null }, { aiAnalysisJson: null }, { status: "analysis_error" }],
            searchProfileId: { not: null }
          },
      take: body.limit,
      orderBy: { createdAt: "asc" },
      include: {
        searchProfile: true
      }
    });

    let analyzed = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const vacancy of vacancies) {
      if (!vacancy.searchProfile?.resumeId) {
        skipped += 1;
        continue;
      }

      if (!vacancy.rawDescription || vacancy.rawDescription.length < 300) {
        skipped += 1;
        await prisma.vacancy.update({
          where: { id: vacancy.id },
          data: { status: "needs_review", recommendation: "Не удалось извлечь полный текст вакансии. Проверьте вручную." }
        });
        continue;
      }

      try {
        await analyzeStoredVacancy({
          vacancyId: vacancy.id,
          resumeId: vacancy.searchProfile.resumeId,
          searchProfileId: vacancy.searchProfileId
        });
        analyzed += 1;
      } catch (error) {
        const message = `${vacancy.title}: ${error instanceof Error ? error.message : "AI-анализ не удался"}`;
        errors.push(message);
        await prisma.vacancy.update({
          where: { id: vacancy.id },
          data: { status: "analysis_error", recommendation: message }
        });
      }
    }

    const [recommended, readyToApply, needsReview] = await Promise.all([
      prisma.vacancy.count({ where: { status: "ai_recommended" } }),
      prisma.vacancy.count({ where: { status: "ready_to_apply" } }),
      prisma.vacancy.count({ where: { status: "needs_review" } })
    ]);

    return NextResponse.json({
      ok: true,
      analyzed,
      skipped,
      errors,
      recommended,
      readyToApply,
      needsReview
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "Не удалось запустить массовый AI-анализ." },
      { status: 400 }
    );
  }
}
