import { z } from "zod";
import { callAiRouter } from "@/lib/ai-router";
import { chooseModelForRole, providerPresets } from "@/lib/ai-presets";

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
}) {
  const baseMessages: ChatMessage[] = [
    {
      role: "system",
      content:
        "Ты аналитический JSON-обработчик для CareerOS. Верни только валидный JSON на русском языке. Не придумывай опыт кандидата. Используй только факты из резюме и вакансии. Если требование не подтверждено резюме, добавь его в missing_requirements. Если вакансия мутная, прямо укажи red_flags. Не пиши сопроводительное письмо."
    },
    {
      role: "user",
      content: `Верни JSON с ключами vacancy_match_score, confidence, summary, why_matches, weak_matches, red_flags, missing_requirements, recommended_resume_angle, recommended_cover_letter_focus, should_apply, reasoning_short, suggested_next_action, questions_to_clarify, avoid_claims, cover_letter_brief.

Резюме:
${params.resumeText}

Профиль поиска:
${JSON.stringify(params.searchProfile ?? {}, null, 2)}

Вакансия:
${JSON.stringify(params.vacancy, null, 2)}`
    }
  ];

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const result = await callAiRouter({
      role: "analysis",
      taskType: "vacancy_analysis",
      messages:
        attempt === 0
          ? baseMessages
          : [...baseMessages, { role: "user", content: "Предыдущий ответ был невалидным JSON. Верни только JSON без markdown." }],
      responseFormat: "json",
      temperature: 0.15
    });

    try {
      return {
        analysis: vacancyAnalysisSchema.parse(JSON.parse(result.content)),
        meta: { provider: result.provider, model: result.model, role: result.role }
      };
    } catch {
      if (attempt === 1) throw new Error("AI вернул невалидный JSON анализа вакансии. Попробуйте ещё раз или выберите другую модель аналитика.");
    }
  }

  throw new Error("Не удалось получить анализ вакансии.");
}

export async function reviewVacancyAnalysisWithAi(params: { analysis: VacancyAnalysis; vacancy: Record<string, unknown> }) {
  const result = await callAiRouter({
    role: "reviewer",
    taskType: "vacancy_review",
    responseFormat: "json",
    temperature: 0.1,
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
    review: reviewerSchema.parse(JSON.parse(result.content)),
    meta: { provider: result.provider, model: result.model, role: result.role }
  };
}

export async function generateCoverLetterWithAi(params: {
  resumeText: string;
  vacancy: { title: string; companyName?: string | null; rawDescription?: string | null; aiAnalysisJson?: string | null };
  analysis: VacancyAnalysis;
  instruction?: string;
}) {
  const brief = {
    vacancy_title: params.vacancy.title,
    company: params.vacancy.companyName,
    candidate_strengths: params.analysis.cover_letter_brief.candidate_strengths,
    job_priorities: params.analysis.cover_letter_brief.job_priorities,
    red_flags: params.analysis.red_flags,
    avoid_claims: params.analysis.avoid_claims,
    recommended_cover_letter_focus: params.analysis.recommended_cover_letter_focus,
    tone: params.instruction || params.analysis.cover_letter_brief.tone
  };

  const result = await callAiRouter({
    role: "writer",
    taskType: "cover_letter",
    responseFormat: "json",
    temperature: 0.25,
    messages: [
      {
        role: "system",
        content:
          "Ты пишешь короткое сопроводительное письмо на русском языке. Не придумывай опыт, используй только факты из выжимки и резюме. Письмо должно быть деловым, живым и пригодным для копирования работодателю. Верни строгий JSON: {\"cover_letter\":\"...\"}."
      },
      {
        role: "user",
        content: `Напиши сопроводительное письмо.

Краткая выжимка:
${JSON.stringify(brief, null, 2)}

Минимальные факты из резюме:
${params.resumeText}`
      }
    ]
  });

  return {
    coverLetter: z.object({ cover_letter: z.string().min(1) }).parse(JSON.parse(result.content)).cover_letter,
    meta: { provider: result.provider, model: result.model, role: result.role }
  };
}

export const regenerateCoverLetterWithAi = generateCoverLetterWithAi;

export { providerPresets };
