import { analyzeVacancyWithAi, generateCoverLetterWithAi, reviewVacancyAnalysisWithAi, VacancyAnalysis } from "@/lib/ai";
import { AiAnalysisError } from "@/lib/ai-errors";
import { fromJsonText } from "@/lib/json";
import { prisma } from "@/lib/prisma";
import { statusFromAiAnalysis } from "@/lib/vacancy-status";
import { vacancyAnalysisStorage } from "@/lib/vacancy-service";

async function markVacancyAnalysisError(vacancyId: string, params: { code: string; message: string; technicalDetails?: string }) {
  await prisma.vacancy.update({
    where: { id: vacancyId },
    data: {
      status: "analysis_error",
      analysisErrorCode: params.code,
      analysisErrorMessage: params.message,
      recommendation: params.message
    }
  });
}

export async function analyzeStoredVacancy(params: {
  vacancyId: string;
  resumeId: string;
  searchProfileId?: string | null;
}) {
  const [vacancy, resume, profile] = await Promise.all([
    prisma.vacancy.findUniqueOrThrow({ where: { id: params.vacancyId }, include: { company: true } }),
    prisma.resume.findUniqueOrThrow({ where: { id: params.resumeId } }),
    params.searchProfileId ? prisma.searchProfile.findUnique({ where: { id: params.searchProfileId } }) : null
  ]);

  const vacancyPayload = {
    title: vacancy.title,
    companyName: vacancy.company?.name || undefined,
    source: vacancy.source,
    sourceUrl: vacancy.sourceUrl || undefined,
    salaryText: vacancy.salaryText || undefined,
    location: vacancy.location || undefined,
    workFormat: vacancy.workFormat || undefined,
    rawDescription: vacancy.rawDescription || undefined,
    publishedAtText: vacancy.publishedAtText || undefined,
    employerUrl: vacancy.employerUrl || undefined,
    isArchived: vacancy.isArchived || undefined,
    testRequired: vacancy.testRequired || undefined
  };

  let initialAnalysis: VacancyAnalysis;
  let analysisMeta: { provider: string; model: string; role: string };

  try {
    const analyzed = await analyzeVacancyWithAi({
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
    initialAnalysis = analyzed.analysis;
    analysisMeta = analyzed.meta;
  } catch (error) {
    if (error instanceof AiAnalysisError) {
      await markVacancyAnalysisError(vacancy.id, {
        code: error.code,
        message: error.userMessage,
        technicalDetails: error.technicalDetails
      });
      throw error;
    }
    await markVacancyAnalysisError(vacancy.id, {
      code: "AI_ANALYSIS_FAILED",
      message: error instanceof Error ? error.message : "AI-анализ не удался."
    });
    throw error;
  }

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

  const { coverLetter, meta: writerMeta } = await generateCoverLetterWithAi({
    resumeText: resume.originalText,
    confirmedFacts: resume.confirmedFacts,
    vacancy: {
      title: vacancy.title,
      companyName: vacancy.company?.name || null,
      rawDescription: vacancy.rawDescription
    },
    analysis
  });

  const status = statusFromAiAnalysis({
    shouldApply: analysis.should_apply,
    score: analysis.vacancy_match_score
  });

  const updated = await prisma.$transaction(async (tx) => {
    const updatedVacancy = await tx.vacancy.update({
      where: { id: vacancy.id },
      data: {
        status,
        analysisErrorCode: null,
        analysisErrorMessage: null,
        ...vacancyAnalysisStorage(analysis),
        aiMetaJson: JSON.stringify({
          analysis: analysisMeta,
          writer: writerMeta,
          reviewer: reviewerMeta,
          reviewerResult
        })
      }
    });

    const letter = await tx.coverLetter.create({
      data: {
        vacancyId: vacancy.id,
        resumeId: resume.id,
        text: coverLetter,
        style: "письмо после поиска"
      }
    });

    await tx.interaction.createMany({
      data: [
        {
          vacancyId: vacancy.id,
          companyId: vacancy.companyId,
          type: "vacancy_analyzed",
          occurredAt: new Date(),
          summary: `AI-анализ завершён. Совпадение: ${Math.round(analysis.vacancy_match_score)}.`
        },
        {
          vacancyId: vacancy.id,
          companyId: vacancy.companyId,
          type: "cover_letter_created",
          occurredAt: new Date(),
          summary: "Создано сопроводительное письмо."
        },
        {
          vacancyId: vacancy.id,
          companyId: vacancy.companyId,
          type: "status_changed",
          occurredAt: new Date(),
          summary: `Статус установлен после AI-анализа: ${status}.`
        }
      ]
    });

    return { vacancy: updatedVacancy, coverLetter: letter, analysis };
  });

  return { ...updated, reviewerUsed: needsReviewer };
}
