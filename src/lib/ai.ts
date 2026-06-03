import { z } from "zod";
import { AiAnalysisError, INVALID_AI_JSON_MESSAGE } from "@/lib/ai-errors";
import { type AiRouterContext, callAiRouter, logAiCallError, logAiCallSuccess } from "@/lib/ai-router";
import { chooseModelForRole, providerPresets } from "@/lib/ai-presets";
import { extractJsonFromAiResponse } from "@/lib/extract-json";
import {
  validateCoverLetterText,
  hasCriticalWarnings,
  warningToForbiddenFragment,
  type CoverLetterWarning
} from "@/lib/cover-letter-validator";

const resumeMatchBasisSchema = z.object({
  matched_requirements: z.array(z.string()).default([]),
  unsupported_requirements: z.array(z.string()).default([]),
  specialized_requirements_not_in_resume: z.array(z.string()).default([]),
  recommendation_reason: z.string().default("")
});

export type ResumeMatchBasis = z.infer<typeof resumeMatchBasisSchema>;

export const aiProviderPresets = [
  {
    id: "openai",
    title: "OpenAI",
    description: "Официальный OpenAI API. Подходит для качественного анализа резюме, вакансий и сопроводительных писем.",
    baseUrl: "https://api.openai.com/v1",
    defaultPrimaryModel: "gpt-5.4-mini",
    defaultFastModel: "gpt-5.4-mini",
    enabled: true
  },
  {
    id: "deepseek",
    title: "DeepSeek",
    description: "Экономичный AI-провайдер с OpenAI-совместимым API.",
    baseUrl: "https://api.deepseek.com/v1",
    defaultPrimaryModel: "deepseek-v4-flash",
    defaultFastModel: "deepseek-v4-flash",
    enabled: true
  },
  {
    id: "gemini",
    title: "Google Gemini",
    description: "AI-модели Google. Поддержка отдельного Gemini API будет добавлена позже.",
    baseUrl: "",
    defaultPrimaryModel: "",
    defaultFastModel: "",
    enabled: false
  },
  {
    id: "compatible",
    title: "OpenAI-совместимый API",
    description: "Для OpenRouter, локальных шлюзов и других совместимых сервисов. Подходит опытным пользователям.",
    baseUrl: "",
    defaultPrimaryModel: "",
    defaultFastModel: "",
    enabled: true
  }
];

export function getAiProviderPreset(provider: string) {
  return aiProviderPresets.find((item) => item.id === provider) ?? aiProviderPresets[0];
}

export function chooseRecommendedModels(provider: string, models: string[]) {
  return {
    primary: chooseModelForRole(provider, provider === "deepseek" ? "analysis" : "writer", models),
    fast: chooseModelForRole(provider, provider === "deepseek" ? "fast" : "reviewer", models)
  };
}

export const aiSettingsSchema = z.object({
  aiProvider: z.string().trim().min(1, "Выберите провайдера"),
  aiBaseUrl: z.string().trim().url("Укажите корректный Base URL"),
  aiApiKey: z.string().trim().min(1, "Укажите API-ключ").optional(),
  aiPrimaryModel: z.string().trim().min(1, "Выберите основную модель"),
  aiFastModel: z.string().trim().min(1, "Выберите быструю модель")
});

export const resumeAnalysisSchema = z.object({
  profile_title: z.string().default("Первый профиль поиска"),
  profile_summary: z.string().default(""),
  strengths: z.array(z.string()).default([]),
  possible_directions: z.array(z.string()).default([]),
  target_roles: z.array(z.string()).default([]),
  search_queries: z.array(z.string()).default([]),
  positive_signals: z.array(z.string()).default([]),
  negative_signals: z.array(z.string()).default([]),
  stop_words: z.array(z.string()).default([]),
  cover_letter_tone: z.string().default(""),
  warnings: z.array(z.string()).default([])
});

export type ResumeAnalysis = z.infer<typeof resumeAnalysisSchema>;

export const vacancyAnalysisSchema = z.object({
  vacancy_match_score: z.coerce.number().min(0).max(100),
  confidence: z.enum(["low", "medium", "high"]).default("medium"),
  summary: z.string().default(""),
  why_matches: z.array(z.string()).default([]),
  weak_matches: z.array(z.string()).default([]),
  red_flags: z.array(z.string()).default([]),
  missing_requirements: z.array(z.string()).default([]),
  recommended_resume_angle: z.string().default(""),
  recommended_cover_letter_focus: z.array(z.string()).default([]),
  should_apply: z.enum(["yes", "maybe", "no"]).default("maybe"),
  reasoning_short: z.string().default(""),
  suggested_next_action: z.string().default(""),
  questions_to_clarify: z.array(z.string()).default([]),
  avoid_claims: z.array(z.string()).default([]),
  salary_expectations_requested: z.boolean().default(false),
  resume_match_basis: resumeMatchBasisSchema.default({
    matched_requirements: [],
    unsupported_requirements: [],
    specialized_requirements_not_in_resume: [],
    recommendation_reason: ""
  }),
  cover_letter_brief: z
    .object({
      candidate_strengths: z.array(z.string()).default([]),
      job_priorities: z.array(z.string()).default([]),
      tone: z.string().default("деловой, короткий, человеческий")
    })
    .default({ candidate_strengths: [], job_priorities: [], tone: "деловой, короткий, человеческий" })
});

export type VacancyAnalysis = z.infer<typeof vacancyAnalysisSchema>;

export const reviewerSchema = z.object({
  should_adjust: z.boolean().default(false),
  adjusted_should_apply: z.enum(["yes", "maybe", "no"]).default("maybe"),
  adjusted_score: z.coerce.number().min(0).max(100).optional(),
  missed_nuances: z.array(z.string()).default([]),
  final_recommendation: z.string().default("")
});

export type ReviewerResult = z.infer<typeof reviewerSchema>;

type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

function apiUrl(baseUrl: string, path: string) {
  const trimmed = baseUrl.replace(/\/+$/, "");
  if (trimmed.endsWith(path)) return trimmed;
  if (trimmed.endsWith("/v1")) return `${trimmed}${path}`;
  return `${trimmed}/v1${path}`;
}

async function chatCompletion(params: {
  baseUrl: string;
  apiKey: string;
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  json?: boolean;
}) {
  const response = await fetch(apiUrl(params.baseUrl, "/chat/completions"), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: params.model,
      messages: params.messages,
      temperature: params.temperature ?? 0.2,
      response_format: params.json ? { type: "json_object" } : undefined
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `AI-провайдер вернул ошибку ${response.status}`);
  }

  return response.json() as Promise<{ choices?: Array<{ message?: { content?: string } }> }>;
}

export async function fetchAiModels(params: { baseUrl: string; apiKey: string }) {
  const response = await fetch(apiUrl(params.baseUrl, "/models"), {
    headers: {
      Authorization: `Bearer ${params.apiKey}`,
      "Content-Type": "application/json"
    }
  });

  if (!response.ok) return [];
  const data = (await response.json()) as { data?: Array<{ id?: string }> };
  return (data.data ?? []).map((item) => item.id).filter((id): id is string => Boolean(id)).sort();
}

export async function testAiConnection(input: z.infer<typeof aiSettingsSchema>) {
  const settings = aiSettingsSchema.parse(input);
  if (!settings.aiApiKey) throw new Error("API-ключ нужен для проверки подключения.");

  const result = await chatCompletion({
    baseUrl: settings.aiBaseUrl,
    apiKey: settings.aiApiKey,
    model: settings.aiFastModel || settings.aiPrimaryModel,
    json: true,
    messages: [
      { role: "system", content: "Верни только компактный JSON." },
      { role: "user", content: "Верни {\"ok\":true,\"message\":\"AI настроен\"}." }
    ],
    temperature: 0
  });

  const content = result.choices?.[0]?.message?.content;
  if (!content) throw new Error("AI-провайдер вернул пустой ответ.");
  return { ok: true, content };
}

export async function analyzeResumeWithAi(params: { baseUrl: string; apiKey: string; model: string; resumeText: string }) {
  const result = await chatCompletion({
    baseUrl: params.baseUrl,
    apiKey: params.apiKey,
    model: params.model,
    json: true,
    messages: [
      {
        role: "system",
        content:
          "Ты анализируешь резюме для локальной карьерной CRM. Верни строгий JSON. Все роли, направления, запросы, сигналы и предупреждения выводи только из текста резюме. Не добавляй заранее заданные отрасли, профессии или направления поиска."
      },
      {
        role: "user",
        content: `Проанализируй резюме и верни JSON с ключами: profile_title, profile_summary, strengths, possible_directions, target_roles, search_queries, positive_signals, negative_signals, stop_words, cover_letter_tone, warnings.

Резюме:
${params.resumeText}`
      }
    ],
    temperature: 0.15
  });

  const content = result.choices?.[0]?.message?.content;
  if (!content) throw new Error("AI-провайдер вернул пустой анализ резюме.");
  return resumeAnalysisSchema.parse(JSON.parse(content));
}

export async function analyzeVacancyWithAi(params: {
  resumeText: string;
  searchProfile: Record<string, unknown> | null;
  vacancy: Record<string, unknown>;
  context?: AiRouterContext;
  mode?: "fast" | "full";
  signal?: AbortSignal;
  onProgress?: (message: string) => void | Promise<void>;
  forceFallbackProvider?: "openai";
  salaryExpectations?: { min?: number | null; max?: number | null; preferredText?: string | null; isNet?: boolean | null } | null;
  acceptedObservations?: Array<{ description: string; suggestedRule?: string | null }> | null;
  narrowSpecializationRules?: string[] | null;
}) {
  const { runVacancyAnalysisPipeline } = await import("@/lib/vacancy-analysis-pipeline");
  const result = await runVacancyAnalysisPipeline({
    mode: params.mode ?? "fast",
    resumeText: params.resumeText,
    searchProfile: params.searchProfile,
    vacancy: params.vacancy,
    context: params.context,
    signal: params.signal,
    onProgress: params.onProgress,
    forceFallbackProvider: params.forceFallbackProvider,
    salaryExpectations: params.salaryExpectations,
    acceptedObservations: params.acceptedObservations,
    narrowSpecializationRules: params.narrowSpecializationRules
  });
  return {
    analysis: result.analysis,
    meta: result.meta
  };
}

async function parseRouterJson<T>(params: {
  role: "analysis" | "fast" | "writer" | "reviewer";
  taskType: string;
  schema: z.ZodType<T>;
  messages: ChatMessage[];
  temperatures?: number[];
  context?: AiRouterContext;
}) {
  const temperatures = params.temperatures ?? [0.15, 0.05];
  let lastMeta: { provider: string; model: string; role: string } | null = null;

  for (let attempt = 0; attempt < temperatures.length; attempt += 1) {
    const startedAt = new Date();
    const result = await callAiRouter({
      role: params.role,
      taskType: params.taskType,
      messages:
        attempt === 0
          ? params.messages
          : [
              ...params.messages,
              {
                role: "user",
                content: "Предыдущий ответ был невалидным JSON. Верни только JSON без markdown."
              }
            ],
      responseFormat: "json",
      temperature: temperatures[attempt],
      context: { ...params.context, attemptNumber: attempt + 1 },
      deferSuccessLog: true
    });
    lastMeta = { provider: result.provider, model: result.model, role: result.role };
    const jsonText = extractJsonFromAiResponse(result.content);
    if (jsonText) {
      try {
        const value = params.schema.parse(JSON.parse(jsonText));
        await logAiCallSuccess({
          taskType: params.taskType,
          provider: result.provider,
          model: result.model,
          role: params.role,
          usage: result.usage,
          context: { ...params.context, attemptNumber: attempt + 1 },
          startedAt,
          finishedAt: new Date()
        });
        return { value, meta: lastMeta };
      } catch {
        // retry
      }
    }
  }

  if (lastMeta) {
    await logAiCallError({
      taskType: params.taskType,
      provider: lastMeta.provider,
      model: lastMeta.model,
      role: params.role,
      errorCode: "INVALID_AI_JSON",
      errorMessage: "AI вернул невалидный JSON.",
      context: params.context
    });
  }

  throw new AiAnalysisError({
    code: "INVALID_AI_JSON",
    userMessage: INVALID_AI_JSON_MESSAGE
  });
}

export async function reviewVacancyAnalysisWithAi(params: {
  analysis: VacancyAnalysis;
  vacancy: Record<string, unknown>;
  context?: AiRouterContext;
}) {
  const parsed = await parseRouterJson({
    role: "reviewer",
    taskType: "vacancy_review",
    schema: reviewerSchema,
    temperatures: [0.1, 0.05],
    context: params.context,
    messages: [
      { role: "system", content: "Ты проверяешь спорный AI-анализ вакансии. Верни только JSON. Не придумывай факты." },
      {
        role: "user",
        content: `Проверь анализ вакансии и верни JSON с ключами should_adjust, adjusted_should_apply, adjusted_score, missed_nuances, final_recommendation.

Анализ:
${JSON.stringify(params.analysis, null, 2)}

Вакансия:
${JSON.stringify(params.vacancy, null, 2)}`
      }
    ]
  });

  return {
    review: parsed.value,
    meta: parsed.meta
  };
}

/**
 * Checks whether a candidate strength is relevant to a vacancy by prefix-matching
 * its significant words against matched requirements and job priorities.
 * Uses 5-char prefix matching to handle Russian inflection
 * (e.g. "договорную" and "договорной" share prefix "догов").
 */
function isStrengthRelevant(strength: string, referenceTexts: string[]): boolean {
  const strengthWords = strength.toLowerCase().split(/\s+/).filter((w) => w.length > 4);
  return referenceTexts.some((ref) => {
    const refWords = ref.toLowerCase().split(/\s+/).filter((w) => w.length > 4);
    return strengthWords.some((sw) =>
      refWords.some((rw) => rw.startsWith(sw.slice(0, 5)) || sw.startsWith(rw.slice(0, 5)))
    );
  });
}

function buildWriterSystemPrompt(options: {
  salaryInstruction: string;
  forbiddenInstruction: string;
  weakMatchWarning: string;
}): string {
  return (
    'Ты пишешь короткое сопроводительное письмо на русском языке.\n' +
    'Формат — строго 2–3 абзаца, не более 5 предложений суммарно.\n' +
    '\n' +
    'Структура:\n' +
    '1. «Здравствуйте.»\n' +
    '2. «Рассматриваю вашу вакансию «{vacancy_title}». По описанию вижу акцент на {2–4 конкретные задачи из job_priorities}.»\n' +
    '3. «У меня есть релевантный опыт по {2–4 факта из relevant_candidate_facts, прямо соответствующие задачам}.»\n' +
    '4. «Готов обсудить задачи, условия и формат работы.»\n' +
    '\n' +
    'Жёсткие правила (нарушение недопустимо):\n' +
    '- Используй ТОЛЬКО факты из relevant_candidate_facts. НЕ добавляй факты из резюме напрямую — резюме предоставлено только для проверки деталей.\n' +
    '- НЕ упоминай факты из excluded_facts — они нерелевантны для этой вакансии.\n' +
    '- Не перечисляй более 3–4 направлений опыта. Не добавляй блок «также есть опыт…» если он не связан с job_priorities.\n' +
    '- Не используй unsupported_requirements и не утверждай опыт из avoid_claims.\n' +
    '- Не упоминай прошлых работодателей и названия компаний.\n' +
    '- Не обещай удалёнку, офис, гибрид, командировки — только «готов обсудить условия и формат работы».\n' +
    '- Судебные споры, иски, претензионная работа, досудебное урегулирование — ТОЛЬКО если job_priorities содержат суды / претензии / споры / взыскание.\n' +
    '- Корпоративное сопровождение — ТОЛЬКО если job_priorities содержат корпоративные процедуры / ЛНА / корп. имущество / регистрацию юрлиц.\n' +
    '- Руководство командой/отделом, KPI, управление людьми — ТОЛЬКО если vacancy_title или job_priorities содержат руководящую функцию (руководитель / начальник / директор / тимлид).\n' +
    '- Взаимодействие с госорганами — ТОЛЬКО если job_priorities упоминают госорганы / регуляторов / выписки / справки / лицензии.\n' +
    '- Не писать «сейчас я руковожу...»; если руководство релевантно — «есть опыт руководства [функцией]».\n' +
    '- Запрещены слова «уникальный», «идеальный», «выдающийся», «лучший», самопиар.\n' +
    '- Не придумывай опыт — только факты из relevant_candidate_facts и confirmedFacts.\n' +
    '- Тон: деловой, спокойный, человечный, без штампов. Без длинных списков.' +
    (options.weakMatchWarning ? '\n' + options.weakMatchWarning : '') +
    options.salaryInstruction +
    options.forbiddenInstruction +
    '\nВерни строгий JSON: {"cover_letter":"..."}.'
  );
}

export async function generateCoverLetterWithAi(params: {
  resumeText: string;
  confirmedFacts?: string | null;
  vacancy: { title: string; companyName?: string | null; rawDescription?: string | null; aiAnalysisJson?: string | null };
  analysis: VacancyAnalysis;
  instruction?: string;
  context?: AiRouterContext;
  salaryExpectationsRequested?: boolean;
  salaryExpectationPreferredText?: string | null;
  overrideSalaryText?: string | null;
  /** Fragments to explicitly forbid in this generation attempt (passed by auto-regen or UI action). */
  forbiddenFragments?: string[];
}): Promise<{
  coverLetter: string;
  meta: unknown;
  warnings: CoverLetterWarning[];
  autoRegenerated: boolean;
  firstAttemptWarnings?: CoverLetterWarning[];
}> {
  const resumeFacts = [
    params.resumeText.slice(0, 2500),
    params.confirmedFacts ? `Подтверждённые пользователем факты:\n${params.confirmedFacts}` : ""
  ]
    .filter(Boolean)
    .join("\n\n");

  const matchedRequirements = params.analysis.resume_match_basis?.matched_requirements ?? [];
  const jobPriorities = params.analysis.cover_letter_brief.job_priorities;
  const coverLetterFocus = params.analysis.recommended_cover_letter_focus;

  // Filter candidate_strengths: keep only facts that are directly linked to what
  // the vacancy actually requires (matched_requirements OR job_priorities).
  const allStrengths = params.analysis.cover_letter_brief.candidate_strengths;
  const relevantCandidateFacts = allStrengths.filter((strength) =>
    isStrengthRelevant(strength, [...matchedRequirements, ...jobPriorities])
  );

  // Facts not included go to excludedFacts so the writer explicitly knows not to mention them.
  const excludedFacts = allStrengths.filter((s) => !relevantCandidateFacts.includes(s));

  const brief = {
    vacancy_title: params.vacancy.title,
    vacancy_key_tasks: jobPriorities,
    relevant_candidate_facts: relevantCandidateFacts,
    matched_requirements: matchedRequirements,
    red_flags: params.analysis.red_flags,
    avoid_claims: params.analysis.avoid_claims,
    excluded_facts: excludedFacts,
    unsupported_requirements: params.analysis.resume_match_basis?.unsupported_requirements ?? [],
    recommended_cover_letter_focus: coverLetterFocus,
    style_instruction: params.instruction || params.analysis.cover_letter_brief.tone
  };

  const salaryRequested =
    params.overrideSalaryText !== undefined
      ? params.overrideSalaryText !== null
      : (params.salaryExpectationsRequested ?? params.analysis.salary_expectations_requested ?? false);

  const salaryText =
    params.overrideSalaryText !== undefined
      ? params.overrideSalaryText
      : (params.salaryExpectationPreferredText ?? null);

  let salaryInstruction = "";
  if (salaryRequested) {
    if (salaryText) {
      salaryInstruction =
        `\n- Работодатель просит указать зарплатные ожидания. Добавь в конец письма фразу: «${salaryText}»`;
    } else {
      salaryInstruction =
        "\n- Работодатель просит указать зарплатные ожидания. Добавь фразу: «Готов обсудить задачи, условия и зарплатные ожидания.» — не придумывай сумму.";
    }
  }

  const weakMatchWarning =
    relevantCandidateFacts.length === 0
      ? "- ВАЖНО: у кандидата нет чётко совпадающих фактов с задачами вакансии. Напиши короткое осторожное письмо без натяжки нерелевантного опыта."
      : "";

  // Build forbidden fragment instruction (from caller or inner auto-regen)
  function buildForbiddenInstruction(fragments: string[]): string {
    if (!fragments.length) return "";
    return `\n\nПредыдущее письмо содержало нерелевантные фрагменты. НЕ используй: ${fragments.join("; ")}.`;
  }

  // Build validation context from params for the validator
  const validationCtx = {
    vacancyTitle: params.vacancy.title,
    vacancyKeyTasks: [
      ...jobPriorities,
      ...(Array.isArray(coverLetterFocus) ? coverLetterFocus : coverLetterFocus ? [coverLetterFocus] : [])
    ],
    matchedRequirements,
    salaryExpectationsRequested: salaryRequested,
    salaryPreferredText: salaryText
  };

  const userMessage = {
    role: "user" as const,
    content: `Напиши сопроводительное письмо.

Данные вакансии и анализа:
${JSON.stringify(brief, null, 2)}

Факты из резюме кандидата:
${resumeFacts}`
  };

  // ─── First attempt ────────────────────────────────────────────────────────
  const forbiddenInstruction1 = buildForbiddenInstruction(params.forbiddenFragments ?? []);
  const parsed1 = await parseRouterJson({
    role: "writer",
    taskType: "cover_letter",
    schema: z.object({ cover_letter: z.string().min(1) }),
    temperatures: [0.25, 0.1],
    context: params.context,
    messages: [
      {
        role: "system",
        content: buildWriterSystemPrompt({ salaryInstruction, forbiddenInstruction: forbiddenInstruction1, weakMatchWarning })
      },
      userMessage
    ]
  });

  const firstText = parsed1.value.cover_letter;
  const firstWarnings = validateCoverLetterText(firstText, validationCtx);

  // ─── Auto-regeneration on critical warnings ────────────────────────────────
  if (hasCriticalWarnings(firstWarnings)) {
    const criticalFragments = firstWarnings
      .filter((w) => w.level === "critical")
      .map(warningToForbiddenFragment);

    const forbiddenInstruction2 = buildForbiddenInstruction([
      ...(params.forbiddenFragments ?? []),
      ...criticalFragments
    ]);

    const parsed2 = await parseRouterJson({
      role: "writer",
      taskType: "cover_letter",
      schema: z.object({ cover_letter: z.string().min(1) }),
      temperatures: [0.1, 0.05],
      context: params.context,
      messages: [
        {
          role: "system",
          content: buildWriterSystemPrompt({ salaryInstruction, forbiddenInstruction: forbiddenInstruction2, weakMatchWarning })
        },
        userMessage
      ]
    });

    const secondText = parsed2.value.cover_letter;
    const secondWarnings = validateCoverLetterText(secondText, validationCtx);

    return {
      coverLetter: secondText,
      meta: parsed2.meta,
      warnings: secondWarnings,
      autoRegenerated: true,
      firstAttemptWarnings: firstWarnings
    };
  }

  return {
    coverLetter: firstText,
    meta: parsed1.meta,
    warnings: firstWarnings,
    autoRegenerated: false
  };
}

export const regenerateCoverLetterWithAi = generateCoverLetterWithAi;

export { providerPresets };
