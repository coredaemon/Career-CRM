import { NextResponse } from "next/server";
import { z } from "zod";
import { analyzeVacancyWithAi, generateCoverLetterWithAi, reviewVacancyAnalysisWithAi, VacancyAnalysis } from "@/lib/ai";
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
  rawDescription: z.string().trim().min(50, "Добавьте текст вакансии для анализа"),
  nextActionType: z.string().trim().optional().nullable(),
  nextActionAt: z.string().trim().optional().nullable(),
  nextActionNote: z.string().trim().optional().nullable(),
  testRequired: z.boolean().optional().nullable(),
  testStatus: z.string().trim().optional().nullable(),
  testLink: z.string().trim().optional().nullable(),
  testNotes: z.string().trim().optional().nullable()
});

export async function POST(request: Request) {
  try {
    const draft = analyzeSchema.parse(await request.json());
    const [settings, resume, profile] = await Promise.all([
      getUserSettings(),
      prisma.resume.findUniqueOrThrow({ where: { id: draft.resumeId } }),
      draft.searchProfileId ? prisma.searchProfile.findUnique({ where: { id: draft.searchProfileId } }) : null
    ]);

    if (!settings.aiConfigured) {
      return NextResponse.json({ ok: false, message: "Сначала сохраните оба контура AI в настройках." }, { status: 400 });
    }

    const vacancyPayload = {
      title: draft.title,
      companyName: draft.companyName || undefined,
      source: draft.source,
      sourceUrl: draft.sourceUrl || undefined,
      salaryText: draft.salaryText || undefined,
      location: draft.location || undefined,
      workFormat: draft.workFormat || undefined,
      rawDescription: draft.rawDescription
    };

    const { analysis: initialAnalysis, meta: analysisMeta } = await analyzeVacancyWithAi({
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
      vacancy: vacancyPayload
    });

    let analysis: VacancyAnalysis = initialAnalysis;
    let reviewerMeta: unknown = null;
    let reviewerResult: unknown = null;
    const needsReviewer = analysis.confidence === "low" || (analysis.vacancy_match_score >= 40 && analysis.vacancy_match_score <= 69);

    if (needsReviewer) {
      const review = await reviewVacancyAnalysisWithAi({ analysis, vacancy: vacancyPayload });
      reviewerMeta = review.meta;
      reviewerResult = review.review;
      if (review.review.should_adjust) {
        analysis = {
          ...analysis,
          should_apply: review.review.adjusted_should_apply,
          vacancy_match_score: review.review.adjusted_score ?? analysis.vacancy_match_score,
          reasoning_short: review.review.final_recommendation || analysis.reasoning_short
        };
      }
    }

    const { coverLetter: coverLetterText, meta: writerMeta } = await generateCoverLetterWithAi({
      resumeText: resume.originalText,
      vacancy: {
        title: draft.title,
        companyName: draft.companyName || null,
        rawDescription: draft.rawDescription
      },
      analysis
    });

    if (draft.mode === "analyze_only") {
      return NextResponse.json({ ok: true, analysis, reviewerResult, coverLetter: coverLetterText });
    }

    const company = await findOrCreateCompany(draft.companyName);
    const status = statusFromAiDecision(analysis.should_apply);

    const result = await prisma.$transaction(async (tx) => {
      const vacancy = await tx.vacancy.create({
        data: {
          ...vacancyCreateData(draft, company?.id ?? null, status),
          ...vacancyAnalysisStorage(analysis),
          aiMetaJson: JSON.stringify({
            analysis: analysisMeta,
            writer: writerMeta,
            reviewer: reviewerMeta,
            reviewerResult
          })
        }
      });

      const coverLetter = await tx.coverLetter.create({
        data: {
          vacancyId: vacancy.id,
          resumeId: resume.id,
          text: coverLetterText,
          style: "первое письмо AI"
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
            summary: `AI-анализ завершён. Совпадение: ${Math.round(analysis.vacancy_match_score)}.`
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
