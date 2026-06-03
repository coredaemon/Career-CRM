import { NextResponse } from "next/server";
import { z } from "zod";
import { analyzeVacancyWithAi } from "@/lib/ai";
import { fromJsonText } from "@/lib/json";
import { prisma } from "@/lib/prisma";
import { getUserSettings } from "@/lib/settings";
import { statusFromAiDecision } from "@/lib/vacancy-status";
import { findOrCreateCompany, vacancyAnalysisStorage, vacancyCreateData } from "@/lib/vacancy-service";

const analyzeSchema = z.object({
  mode: z.enum(["analyze_and_save", "analyze_only"]).default("analyze_and_save"),
  resumeId: z.string().min(1, "Выберите резюме"),
  searchProfileId: z.string().optional().nullable(),
  source: z.enum(["hh", "manual", "other"]),
  sourceUrl: z.string().trim().optional().nullable(),
  title: z.string().trim().min(1, "Укажите название вакансии"),
  companyName: z.string().trim().optional().nullable(),
  salaryText: z.string().trim().optional().nullable(),
  location: z.string().trim().optional().nullable(),
  workFormat: z.string().trim().optional().nullable(),
  rawDescription: z.string().trim().min(50, "Добавьте описание вакансии для анализа")
});

export async function POST(request: Request) {
  try {
    const draft = analyzeSchema.parse(await request.json());
    const [settings, resume, profile] = await Promise.all([
      getUserSettings(),
      prisma.resume.findUniqueOrThrow({ where: { id: draft.resumeId } }),
      draft.searchProfileId ? prisma.searchProfile.findUnique({ where: { id: draft.searchProfileId } }) : null
    ]);

    const baseUrl = settings.aiBaseUrl || process.env.AI_BASE_URL || "";
    const apiKey = process.env.AI_API_KEY || "";
    const model = settings.aiPrimaryModel || process.env.AI_PRIMARY_MODEL || "";

    if (!baseUrl || !apiKey || !model) {
      return NextResponse.json(
        { ok: false, message: "Для AI-анализа нужен AI_BASE_URL, AI_API_KEY и AI_PRIMARY_MODEL в локальном окружении." },
        { status: 400 }
      );
    }

    const analysis = await analyzeVacancyWithAi({
      baseUrl,
      apiKey,
      model,
      resumeText: resume.originalText,
      searchProfile: profile
        ? {
            title: profile.title,
            summary: profile.summary,
            targetRoles: fromJsonText<string[]>(profile.targetRolesJson, []),
            searchQueries: fromJsonText<string[]>(profile.searchQueriesJson, []),
            positiveSignals: fromJsonText<string[]>(profile.positiveSignalsJson, []),
            negativeSignals: fromJsonText<string[]>(profile.negativeSignalsJson, []),
            stopWords: fromJsonText<string[]>(profile.stopWordsJson, [])
          }
        : null,
      vacancy: draft
        ? {
            title: draft.title,
            companyName: draft.companyName || undefined,
            source: draft.source,
            sourceUrl: draft.sourceUrl || undefined,
            salaryText: draft.salaryText || undefined,
            location: draft.location || undefined,
            workFormat: draft.workFormat || undefined,
            rawDescription: draft.rawDescription
          }
        : draft
    });

    if (draft.mode === "analyze_only") {
      return NextResponse.json({ ok: true, analysis });
    }

    const company = await findOrCreateCompany(draft.companyName);
    const status = statusFromAiDecision(analysis.should_apply);

    const result = await prisma.$transaction(async (tx) => {
      const vacancy = await tx.vacancy.create({
        data: {
          ...vacancyCreateData(draft, company?.id ?? null, status),
          ...vacancyAnalysisStorage(analysis)
        }
      });

      const coverLetter = await tx.coverLetter.create({
        data: {
          vacancyId: vacancy.id,
          resumeId: resume.id,
          text: analysis.cover_letter,
          style: "ai_initial"
        }
      });

      await tx.interaction.createMany({
        data: [
          {
            vacancyId: vacancy.id,
            companyId: company?.id ?? null,
            type: "vacancy_created",
            occurredAt: new Date(),
            summary: "Вакансия добавлена вручную."
          },
          {
            vacancyId: vacancy.id,
            companyId: company?.id ?? null,
            type: "vacancy_analyzed",
            occurredAt: new Date(),
            summary: `AI-анализ завершён. Score: ${Math.round(analysis.vacancy_match_score)}.`
          },
          {
            vacancyId: vacancy.id,
            companyId: company?.id ?? null,
            type: "cover_letter_created",
            occurredAt: new Date(),
            summary: "Создано сопроводительное письмо."
          },
          {
            vacancyId: vacancy.id,
            companyId: company?.id ?? null,
            type: "status_changed",
            occurredAt: new Date(),
            summary: `Статус установлен: ${status}.`
          }
        ]
      });

      return { vacancy, coverLetter };
    });

    return NextResponse.json({ ok: true, analysis, ...result });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "Не удалось проанализировать вакансию." },
      { status: 400 }
    );
  }
}
