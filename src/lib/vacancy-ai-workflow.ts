import {
  analyzeVacancyWithAi,
  generateCoverLetterWithAi,
  reviewVacancyAnalysisWithAi,
  VacancyAnalysis,
  vacancyAnalysisSchema
} from "@/lib/ai";
import {
  type AnalysisMode,
  analysisModeIncludesAnalysis,
  analysisModeIncludesReviewer,
  analysisModeIncludesWriter,
  parseAnalysisMode
} from "@/lib/analysis-mode";
import { AiAnalysisError, INVALID_VACANCY_SOURCE_MESSAGE } from "@/lib/ai-errors";
import { fromJsonText } from "@/lib/json";
import { prisma } from "@/lib/prisma";
import { statusFromAiAnalysis } from "@/lib/vacancy-status";
import { vacancyAnalysisStorage } from "@/lib/vacancy-service";
import { validateVacancyDraft } from "@/lib/vacancy-validation";

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
  mode?: AnalysisMode;
  processRunId?: string;
  onLog?: (message: string) => void | Promise<void>;
}) {
  const mode = parseAnalysisMode(params.mode ?? "fast");
  const aiContext = { vacancyId: params.vacancyId, processRunId: params.processRunId };

  const [vacancy, resume, profile, existingLetter] = await Promise.all([
    prisma.vacancy.findUniqueOrThrow({ where: { id: params.vacancyId }, include: { company: true } }),
    prisma.resume.findUniqueOrThrow({ where: { id: params.resumeId } }),
    params.searchProfileId ? prisma.searchProfile.findUnique({ where: { id: params.searchProfileId } }) : null,
    prisma.coverLetter.findFirst({ where: { vacancyId: params.vacancyId, resumeId: params.resumeId }, orderBy: { createdAt: "desc" } })
  ]);

  const vacancyPayload = {
    title: vacancy.title,
    companyName: vacancy.company?.name || undefined,
    source: vacancy.source,
    sourceUrl: vacancy.sourceUrl || undefined,
    sourceVacancyId: vacancy.sourceVacancyId || undefined,
    salaryText: vacancy.salaryText || undefined,
    location: vacancy.location || undefined,
    workFormat: vacancy.workFormat || undefined,
    rawDescription: vacancy.rawDescription || undefined,
    publishedAtText: vacancy.publishedAtText || undefined,
    employerUrl: vacancy.employerUrl || undefined,
    isArchived: vacancy.isArchived || undefined,
    testRequired: vacancy.testRequired || undefined
  };

  if (mode !== "letters_only") {
    const validation = validateVacancyDraft(vacancyPayload);
    if (!validation.ok) {
      await prisma.vacancy.update({
        where: { id: vacancy.id },
        data: {
          status: "invalid_source",
          analysisErrorCode: "INVALID_VACANCY_SOURCE",
          analysisErrorMessage: INVALID_VACANCY_SOURCE_MESSAGE,
          recommendation: validation.reason || INVALID_VACANCY_SOURCE_MESSAGE
        }
      });
      await params.onLog?.("Пропущено: невалидная вакансия");
      throw new AiAnalysisError({
        code: "INVALID_VACANCY_SOURCE",
        userMessage: INVALID_VACANCY_SOURCE_MESSAGE,
        technicalDetails: validation.reason
      });
    }
  }

  const searchProfilePayload = profile
    ? {
        title: profile.title,
        summary: profile.summary,
        targetRoles: fromJsonText<string[]>(profile.targetRolesJson, []),
        searchQueries: fromJsonText<string[]>(profile.searchQueriesJson, []),
        positiveSignals: fromJsonText<string[]>(profile.positiveSignalsJson, []),
        negativeSignals: fromJsonText<string[]>(profile.negativeSignalsJson, []),
        stopWords: fromJsonText<string[]>(profile.stopWordsJson, [])
      }
    : null;

  let analysis: VacancyAnalysis;
  let analysisMeta: { provider: string; model: string; role: string } = { provider: "", model: "", role: "analysis" };
  let reviewerMeta: unknown = null;
  let reviewerResult: unknown = null;
  let writerMeta: unknown = null;
  let coverLetterText: string | null = null;
  let reviewerUsed = false;

  if (mode === "letters_only") {
    if (!vacancy.aiAnalysisJson) {
      throw new AiAnalysisError({
        code: "NO_ANALYSIS",
        userMessage: "Сначала нужен AI-анализ вакансии."
      });
    }
    if (existingLetter) {
      const analysis = vacancyAnalysisSchema.parse(JSON.parse(vacancy.aiAnalysisJson));
      return {
        vacancy,
        coverLetter: existingLetter,
        analysis,
        reviewerUsed: false,
        coverLetterCreated: false
      };
    }
    const stored = vacancyAnalysisSchema.parse(JSON.parse(vacancy.aiAnalysisJson));
    analysis = stored;
    await params.onLog?.("Создаём сопроводительное письмо.");
    const { coverLetter, meta } = await generateCoverLetterWithAi({
      resumeText: resume.originalText,
      confirmedFacts: resume.confirmedFacts,
      vacancy: {
        title: vacancy.title,
        companyName: vacancy.company?.name || null,
        rawDescription: vacancy.rawDescription
      },
      analysis,
      context: aiContext
    });
    coverLetterText = coverLetter;
    writerMeta = meta;
  } else if (analysisModeIncludesAnalysis(mode)) {
    await params.onLog?.("Анализируем вакансию.");
    try {
      const analyzed = await analyzeVacancyWithAi({
        resumeText: resume.originalText,
        searchProfile: searchProfilePayload,
        vacancy: vacancyPayload,
        context: aiContext
      });
      analysis = analyzed.analysis;
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

    const needsReviewer =
      analysisModeIncludesReviewer(mode) &&
      (analysis.confidence === "low" || (analysis.vacancy_match_score >= 40 && analysis.vacancy_match_score <= 69));

    if (needsReviewer) {
      await params.onLog?.("Проверяем спорный анализ (reviewer).");
      const review = await reviewVacancyAnalysisWithAi({ analysis, vacancy: vacancyPayload, context: aiContext });
      reviewerMeta = review.meta;
      reviewerResult = review.review;
      reviewerUsed = true;
      if (review.review.should_adjust) {
        analysis = {
          ...analysis,
          should_apply: review.review.adjusted_should_apply,
          vacancy_match_score: review.review.adjusted_score ?? analysis.vacancy_match_score,
          reasoning_short: review.review.final_recommendation || analysis.reasoning_short
        };
      }
    }

    if (analysisModeIncludesWriter(mode) && !existingLetter) {
      const status = statusFromAiAnalysis({
        shouldApply: analysis.should_apply,
        score: analysis.vacancy_match_score
      });
      const shouldWrite =
        analysisModeIncludesWriter(mode) &&
        (status === "ai_recommended" || status === "ready_to_apply");

      if (shouldWrite) {
        await params.onLog?.("Создаём сопроводительное письмо.");
        const { coverLetter, meta } = await generateCoverLetterWithAi({
          resumeText: resume.originalText,
          confirmedFacts: resume.confirmedFacts,
          vacancy: {
            title: vacancy.title,
            companyName: vacancy.company?.name || null,
            rawDescription: vacancy.rawDescription
          },
          analysis,
          context: aiContext
        });
        coverLetterText = coverLetter;
        writerMeta = meta;
      }
    }
  } else {
    throw new Error("Неизвестный режим анализа.");
  }

  const status = statusFromAiAnalysis({
    shouldApply: analysis!.should_apply,
    score: analysis!.vacancy_match_score
  });

  const updated = await prisma.$transaction(async (tx) => {
    const updatedVacancy = await tx.vacancy.update({
      where: { id: vacancy.id },
      data: {
        status: mode === "letters_only" ? vacancy.status : status,
        analysisErrorCode: null,
        analysisErrorMessage: null,
        ...(mode !== "letters_only" ? vacancyAnalysisStorage(analysis!) : {}),
        aiMetaJson: JSON.stringify({
          analysis: analysisMeta,
          writer: writerMeta,
          reviewer: reviewerMeta,
          reviewerResult,
          mode
        })
      }
    });

    let letter = existingLetter;
    if (coverLetterText && !existingLetter) {
      letter = await tx.coverLetter.create({
        data: {
          vacancyId: vacancy.id,
          resumeId: resume.id,
          text: coverLetterText,
          style: mode === "letters_only" ? "письмо для рекомендованных" : "письмо после поиска"
        }
      });
    }

    const interactions: Array<{
      vacancyId: string;
      companyId: string | null;
      type: string;
      occurredAt: Date;
      summary: string;
    }> = [];

    if (mode !== "letters_only") {
      interactions.push({
        vacancyId: vacancy.id,
        companyId: vacancy.companyId,
        type: "vacancy_analyzed",
        occurredAt: new Date(),
        summary: `AI-анализ завершён. Совпадение: ${Math.round(analysis!.vacancy_match_score)}.`
      });
      interactions.push({
        vacancyId: vacancy.id,
        companyId: vacancy.companyId,
        type: "status_changed",
        occurredAt: new Date(),
        summary: `Статус установлен после AI-анализа: ${status}.`
      });
    }

    if (coverLetterText && letter) {
      interactions.push({
        vacancyId: vacancy.id,
        companyId: vacancy.companyId,
        type: "cover_letter_created",
        occurredAt: new Date(),
        summary: "Создано сопроводительное письмо."
      });
    }

    if (interactions.length > 0) {
      await tx.interaction.createMany({ data: interactions });
    }

    return { vacancy: updatedVacancy, coverLetter: letter, analysis: analysis! };
  });

  return {
    ...updated,
    reviewerUsed,
    coverLetterCreated: Boolean(coverLetterText && !existingLetter)
  };
}
