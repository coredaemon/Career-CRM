import { z } from "zod";
import {
  vacancyAnalysisSchema,
  type VacancyAnalysis
} from "@/lib/ai";
import { AiAnalysisError, INVALID_AI_JSON_MESSAGE } from "@/lib/ai-errors";
import { repairAiJson } from "@/lib/ai-json-repair";
import {
  type AiRouterContext,
  callAiRouter,
  logAiCallError,
  logAiCallSuccess,
  resolveAiRoute,
  resolveFallbackAnalysisRoute
} from "@/lib/ai-router";
import { extractJsonFromAiResponse } from "@/lib/extract-json";
import { getUserSettings } from "@/lib/settings";
import { AI_TIMEOUT_MS_FAST, AI_TIMEOUT_MS_FULL } from "@/lib/process-status";
import {
  fastVacancyAnalysisSchema,
  FULL_ANALYSIS_SCHEMA_DESCRIPTION,
  FULL_ANALYSIS_SCHEMA_JSON_DESCRIPTION,
  FAST_ANALYSIS_SCHEMA_DESCRIPTION,
  normalizeFastAnalysis
} from "@/lib/vacancy-analysis-schemas";
import { NARROW_SPECIALIZATION_RULES } from "@/lib/narrow-specializations";

type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type AnalysisPipelineMode = "fast" | "full";

export type AnalysisPipelineResult = {
  analysis: VacancyAnalysis;
  meta: {
    provider: string;
    model: string;
    role: string;
    analysisFallbackUsed?: boolean;
    fallbackProvider?: string;
    fallbackModel?: string;
    repairUsed?: boolean;
    attemptCount?: number;
    totalDurationMs?: number;
  };
};

export type SalaryExpectations = {
  min?: number | null;
  max?: number | null;
  preferredText?: string | null;
  isNet?: boolean | null;
};

type PipelineParams = {
  mode: AnalysisPipelineMode;
  resumeText: string;
  searchProfile: Record<string, unknown> | null;
  vacancy: Record<string, unknown>;
  context?: AiRouterContext;
  signal?: AbortSignal;
  onProgress?: (message: string) => void | Promise<void>;
  forceFallbackProvider?: "openai";
  salaryExpectations?: SalaryExpectations | null;
  acceptedObservations?: Array<{ description: string; suggestedRule?: string | null }> | null;
  narrowSpecializationRules?: string[] | null;
};

function providerLabel(provider: string) {
  if (provider === "deepseek") return "DeepSeek";
  if (provider === "openai") return "OpenAI";
  return provider;
}

function buildContextSection(params: PipelineParams): string {
  const sections: string[] = [];

  const rules = params.narrowSpecializationRules ?? NARROW_SPECIALIZATION_RULES;
  sections.push(
    `\nПравила скоринга (ОБЯЗАТЕЛЬНО):\n` +
    `- Если вакансия требует как ОСНОВНОЙ профиль узкую специализацию из списка ниже, которая явно отсутствует в резюме: score ≤ 45, should_apply = "no", указать специализацию в specialized_requirements_not_in_resume.\n` +
    `- Если 1–2 ключевых требования не подтверждены резюме: score не выше 65, should_apply = "maybe".\n` +
    `- Если 3+ ключевых требования не подтверждены резюме: score не выше 45, should_apply = "no".\n` +
    `- Если вакансия совпадает по основному профилю с резюме: score 70+, should_apply = "yes" или "maybe".\n` +
    `\nСписок узких специализаций:\n${rules.map((r) => `  - ${r}`).join("\n")}`
  );

  const salary = params.salaryExpectations;
  if (salary?.min || salary?.max) {
    const net = salary.isNet !== false ? " (после вычета налогов)" : " (gross)";
    const range = [salary.min && `от ${salary.min.toLocaleString("ru")} ₽`, salary.max && `до ${salary.max.toLocaleString("ru")} ₽`]
      .filter(Boolean)
      .join(" ");
    sections.push(
      `\nЗарплатные ожидания кандидата: ${range}${net}.\n` +
      `- Если salaryText вакансии явно ниже ${salary.min ?? 0} ₽ — добавить в red_flags "Зарплата ниже ожиданий кандидата" и снизить score.\n` +
      `- Если salaryText отсутствует — добавить в red_flags "Зарплата не указана", вакансию не отбрасывать.\n` +
      `- Если salaryText в диапазоне ожиданий — это положительный сигнал, не добавлять в red_flags.`
    );
  } else {
    sections.push(
      `\n- Если salaryText отсутствует — добавить в red_flags "Зарплата не указана", вакансию не отбрасывать автоматически.`
    );
  }

  sections.push(
    `\n- Если в тексте вакансии есть фразы вроде "укажите зарплатные ожидания", "ожидаемый уровень дохода", "зарплатные ожидания" — выставить salary_expectations_requested = true.`
  );

  const obs = params.acceptedObservations;
  if (obs && obs.length > 0) {
    const lines = obs
      .map((o) => `  - ${o.suggestedRule ?? o.description}`)
      .join("\n");
    sections.push(`\nПодтверждённые пользовательские правила (применять при анализе):\n${lines}`);
  }

  return sections.join("\n");
}

function buildFastMessages(params: PipelineParams): ChatMessage[] {
  const contextSection = buildContextSection(params);
  return [
    {
      role: "system",
      content:
        "Ты аналитический JSON-обработчик для CareerOS. Верни только валидный JSON на русском языке. Не придумывай опыт кандидата. Используй только факты из резюме и вакансии. Максимум 3 пункта в каждом массиве. Без сопроводительного письма и без длинных рассуждений." +
        contextSection
    },
    {
      role: "user",
      content: `Верни JSON строго по схеме:
${FAST_ANALYSIS_SCHEMA_DESCRIPTION}

Резюме:
${params.resumeText.slice(0, 3000)}

Профиль поиска:
${JSON.stringify(params.searchProfile ?? {}, null, 2)}

Вакансия:
${JSON.stringify(params.vacancy, null, 2)}`
    }
  ];
}

function buildFullMessages(params: PipelineParams): ChatMessage[] {
  const contextSection = buildContextSection(params);
  return [
    {
      role: "system",
      content:
        "Ты аналитический JSON-обработчик для CareerOS. Верни только валидный JSON на русском языке. Не придумывай опыт кандидата. Используй только факты из резюме и вакансии. Если требование не подтверждено резюме, добавь его в missing_requirements. Если вакансия мутная, прямо укажи red_flags. Не пиши сопроводительное письмо." +
        contextSection
    },
    {
      role: "user",
      content: `Верни JSON строго по схеме:
${FULL_ANALYSIS_SCHEMA_JSON_DESCRIPTION}

Резюме:
${params.resumeText.slice(0, 3000)}

Профиль поиска:
${JSON.stringify(params.searchProfile ?? {}, null, 2)}

Вакансия:
${JSON.stringify(params.vacancy, null, 2)}`
    }
  ];
}

async function tryParseResponse<T>(
  content: string,
  schema: z.ZodType<T>
): Promise<T | null> {
  const jsonText = extractJsonFromAiResponse(content);
  if (!jsonText) return null;
  try {
    return schema.parse(JSON.parse(jsonText));
  } catch {
    return null;
  }
}

async function runAnalysisAttempt(params: {
  pipelineParams: PipelineParams;
  messages: ChatMessage[];
  role: "fast" | "analysis";
  attemptNumber: number;
  strict: boolean;
  explicitRoute?: { provider: string; baseUrl: string; apiKey: string; model: string };
  taskType?: string;
}) {
  const { pipelineParams, messages, role, attemptNumber, strict, explicitRoute } = params;
  const timeoutMs = pipelineParams.mode === "fast" ? AI_TIMEOUT_MS_FAST : AI_TIMEOUT_MS_FULL;
  const route = explicitRoute ?? (await resolveAiRoute(role));
  const label = `${providerLabel(route.provider)} / ${route.model}${strict ? " (strict)" : ""}`;

  await pipelineParams.onProgress?.(`Попытка ${attemptNumber}: ${label}`);

  const startedAt = new Date();
  const result = await callAiRouter({
    role,
    taskType: params.taskType ?? "vacancy_analysis",
    messages: strict
      ? [
          ...messages,
          {
            role: "user",
            content: "Предыдущий ответ был невалидным JSON. Верни только JSON без markdown, без пояснений и без code block."
          }
        ]
      : messages,
    responseFormat: "json",
    temperature: strict ? 0.05 : 0.15,
    timeoutMs,
    signal: pipelineParams.signal,
    context: { ...pipelineParams.context, attemptNumber },
    explicitRoute,
    deferSuccessLog: true
  });

  const jsonText = extractJsonFromAiResponse(result.content);
  let analysis: VacancyAnalysis | null = null;

  if (jsonText) {
    try {
      if (pipelineParams.mode === "fast") {
        analysis = normalizeFastAnalysis(fastVacancyAnalysisSchema.parse(JSON.parse(jsonText)));
      } else {
        analysis = vacancyAnalysisSchema.parse(JSON.parse(jsonText));
      }
    } catch {
      analysis = null;
    }
  }

  if (analysis) {
    const finishedAt = new Date();
    await logAiCallSuccess({
      taskType: params.taskType ?? "vacancy_analysis",
      provider: result.provider,
      model: result.model,
      role,
      usage: result.usage,
      context: { ...pipelineParams.context, attemptNumber },
      startedAt,
      finishedAt
    });

    const durationSec = Math.round((finishedAt.getTime() - startedAt.getTime()) / 1000);
    await pipelineParams.onProgress?.(`Анализ сохранён, score ${Math.round(analysis.vacancy_match_score)} · ${durationSec} сек`);

    return {
      analysis,
      meta: {
        provider: result.provider,
        model: result.model,
        role,
        attemptCount: attemptNumber,
        totalDurationMs: finishedAt.getTime() - startedAt.getTime()
      },
      rawText: result.content
    };
  }

  await logAiCallError({
    taskType: params.taskType ?? "vacancy_analysis",
    provider: result.provider,
    model: result.model,
    role,
    errorCode: "INVALID_AI_JSON",
    errorMessage: "AI вернул невалидный JSON анализа вакансии.",
    context: { ...pipelineParams.context, attemptNumber },
    startedAt,
    finishedAt: new Date(),
    durationMs: result.durationMs
  });

  return { rawText: result.content, meta: { provider: result.provider, model: result.model, role } };
}

async function shouldUseFallback(forceFallback?: "openai") {
  if (forceFallback === "openai") return true;
  const settings = await getUserSettings();
  const analysisProvider = settings.analysisProvider || process.env.AI_ANALYSIS_PROVIDER || "deepseek";
  return analysisProvider === "deepseek";
}

export async function runVacancyAnalysisPipeline(params: PipelineParams): Promise<AnalysisPipelineResult> {
  const pipelineStart = Date.now();
  const messages = params.mode === "fast" ? buildFastMessages(params) : buildFullMessages(params);
  const role = params.mode === "fast" ? "fast" : "analysis";
  const schemaDescription = params.mode === "fast" ? FAST_ANALYSIS_SCHEMA_DESCRIPTION : FULL_ANALYSIS_SCHEMA_DESCRIPTION;
  const repairSchema = params.mode === "fast" ? fastVacancyAnalysisSchema : vacancyAnalysisSchema;

  let attemptCount = 0;
  let lastRaw = "";
  let lastProvider = "";
  let lastModel = "";
  let repairUsed = false;

  if (params.forceFallbackProvider === "openai") {
    const openAiRoute = await resolveFallbackAnalysisRoute();
    if (!openAiRoute) {
      throw new AiAnalysisError({
        code: "PROVIDER_ERROR",
        userMessage: "OpenAI не настроен. Откройте настройки AI."
      });
    }
    await params.onProgress?.("Анализ через OpenAI (fallback)");
    attemptCount = 1;
    const fallbackAttempt = await runAnalysisAttempt({
      pipelineParams: params,
      messages,
      role: "analysis",
      attemptNumber: attemptCount,
      strict: false,
      explicitRoute: openAiRoute,
      taskType: "vacancy_analysis_fallback"
    });
    if ("analysis" in fallbackAttempt && fallbackAttempt.analysis) {
      return {
        analysis: fallbackAttempt.analysis,
        meta: {
          ...fallbackAttempt.meta,
          analysisFallbackUsed: true,
          fallbackProvider: openAiRoute.provider,
          fallbackModel: openAiRoute.model,
          attemptCount,
          totalDurationMs: Date.now() - pipelineStart
        }
      };
    }
    lastRaw = fallbackAttempt.rawText;
    lastProvider = openAiRoute.provider;
    lastModel = openAiRoute.model;
    throw new AiAnalysisError({
      code: "INVALID_AI_JSON",
      userMessage: INVALID_AI_JSON_MESSAGE,
      technicalDetails: lastRaw.slice(0, 500),
      diagnostics: {
        attempts: attemptCount,
        repairUsed: false,
        fallbackUsed: true,
        totalDurationMs: Date.now() - pipelineStart,
        lastProvider,
        lastModel,
        errorCode: "INVALID_AI_JSON"
      }
    });
  }

  // Attempt 1
  attemptCount += 1;
  const attempt1 = await runAnalysisAttempt({
    pipelineParams: params,
    messages,
    role,
    attemptNumber: attemptCount,
    strict: false
  });
  if ("analysis" in attempt1 && attempt1.analysis) {
    return { analysis: attempt1.analysis, meta: { ...attempt1.meta, repairUsed: false } };
  }
  lastRaw = attempt1.rawText;
  lastProvider = attempt1.meta.provider;
  lastModel = attempt1.meta.model;

  await params.onProgress?.("Ответ не JSON, пробуем строгий повтор");

  // Attempt 2 strict
  attemptCount += 1;
  const attempt2 = await runAnalysisAttempt({
    pipelineParams: params,
    messages,
    role,
    attemptNumber: attemptCount,
    strict: true
  });
  if ("analysis" in attempt2 && attempt2.analysis) {
    return { analysis: attempt2.analysis, meta: { ...attempt2.meta, attemptCount, repairUsed: false } };
  }
  lastRaw = attempt2.rawText;
  lastProvider = attempt2.meta.provider;
  lastModel = attempt2.meta.model;

  // JSON repair
  const fallbackRoute = await resolveAiRoute("reviewer");
  const repairProviderLabel = fallbackRoute.apiKey ? providerLabel(fallbackRoute.provider) : "OpenAI";
  await params.onProgress?.(`JSON снова невалиден, пробуем repair через ${repairProviderLabel}`);

  const repaired = await repairAiJson({
    rawText: lastRaw,
    schema: repairSchema,
    schemaDescription,
    context: params.context,
    signal: params.signal
  });

  if (repaired) {
    repairUsed = true;
    const durationSec = Math.round(repaired.durationMs / 1000);
    await params.onProgress?.(`Repair успешен · ${durationSec} сек`);

    const analysis =
      params.mode === "fast"
        ? normalizeFastAnalysis(repaired.value as z.infer<typeof fastVacancyAnalysisSchema>)
        : (repaired.value as VacancyAnalysis);

    await params.onProgress?.(`Анализ сохранён, score ${Math.round(analysis.vacancy_match_score)}`);

    return {
      analysis,
      meta: {
        provider: repaired.meta.provider,
        model: repaired.meta.model,
        role: repaired.meta.role,
        repairUsed: true,
        attemptCount,
        totalDurationMs: Date.now() - pipelineStart
      }
    };
  }

  await params.onProgress?.("Repair не помог.");

  // OpenAI fallback analysis
  const useFallback = await shouldUseFallback(params.forceFallbackProvider);
  const openAiRoute = await resolveFallbackAnalysisRoute();

  if (useFallback && openAiRoute) {
    await params.onProgress?.("Пробуем fallback analysis через OpenAI");

    attemptCount += 1;
    const fallbackAttempt = await runAnalysisAttempt({
      pipelineParams: params,
      messages,
      role: "analysis",
      attemptNumber: attemptCount,
      strict: false,
      explicitRoute: openAiRoute,
      taskType: "vacancy_analysis_fallback"
    });

    if ("analysis" in fallbackAttempt && fallbackAttempt.analysis) {
      return {
        analysis: fallbackAttempt.analysis,
        meta: {
          ...fallbackAttempt.meta,
          analysisFallbackUsed: true,
          fallbackProvider: openAiRoute.provider,
          fallbackModel: openAiRoute.model,
          repairUsed,
          attemptCount,
          totalDurationMs: Date.now() - pipelineStart
        }
      };
    }

    lastRaw = fallbackAttempt.rawText;
    lastProvider = openAiRoute.provider;
    lastModel = openAiRoute.model;
  }

  await params.onProgress?.("Repair не помог. Вакансия оставлена на ручную проверку.");

  const totalDurationMs = Date.now() - pipelineStart;
  throw new AiAnalysisError({
    code: "INVALID_AI_JSON",
    userMessage: INVALID_AI_JSON_MESSAGE,
    technicalDetails: lastRaw.slice(0, 500),
    diagnostics: {
      attempts: attemptCount,
      repairUsed,
      fallbackUsed: useFallback && Boolean(openAiRoute),
      totalDurationMs,
      lastProvider,
      lastModel,
      errorCode: "INVALID_AI_JSON"
    }
  });
}
