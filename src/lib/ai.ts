import { z } from "zod";

export type AiProviderId = "openai" | "deepseek" | "gemini" | "compatible";

export type AiProviderPreset = {
  id: AiProviderId;
  title: string;
  description: string;
  baseUrl: string;
  defaultPrimaryModel: string;
  defaultFastModel: string;
  enabled: boolean;
};

export const aiProviderPresets: AiProviderPreset[] = [
  {
    id: "openai",
    title: "OpenAI",
    description: "Официальный OpenAI API. Подходит для качественного анализа резюме, вакансий и сопроводительных писем.",
    baseUrl: "https://api.openai.com/v1",
    defaultPrimaryModel: "gpt-4.1",
    defaultFastModel: "gpt-4.1-mini",
    enabled: true
  },
  {
    id: "deepseek",
    title: "DeepSeek",
    description: "Экономичный AI-провайдер с OpenAI-совместимым API.",
    baseUrl: "https://api.deepseek.com/v1",
    defaultPrimaryModel: "deepseek-chat",
    defaultFastModel: "deepseek-chat",
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
  const preset = getAiProviderPreset(provider);
  const lower = models.map((model) => model.toLowerCase());

  function findModel(candidates: string[]) {
    for (const candidate of candidates) {
      const exactIndex = lower.findIndex((model) => model === candidate.toLowerCase());
      if (exactIndex >= 0) return models[exactIndex];
    }
    for (const candidate of candidates) {
      const fuzzyIndex = lower.findIndex((model) => model.includes(candidate.toLowerCase()));
      if (fuzzyIndex >= 0) return models[fuzzyIndex];
    }
    return "";
  }

  if (provider === "openai") {
    return {
      primary: findModel(["gpt-4.1", "gpt-4o", "gpt-5"]) || preset.defaultPrimaryModel,
      fast: findModel(["gpt-4.1-mini", "gpt-4o-mini", "mini"]) || preset.defaultFastModel
    };
  }

  if (provider === "deepseek") {
    return {
      primary: findModel(["deepseek-chat"]) || preset.defaultPrimaryModel,
      fast: findModel(["deepseek-chat"]) || preset.defaultFastModel
    };
  }

  return {
    primary: models[0] || preset.defaultPrimaryModel,
    fast: models[1] || models[0] || preset.defaultFastModel
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
  cover_letter: z.string().default("")
});

export type VacancyAnalysis = z.infer<typeof vacancyAnalysisSchema>;

type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type ChatRequest = {
  baseUrl: string;
  apiKey: string;
  model: string;
  messages: ChatMessage[];
  temperature?: number;
};

function apiUrl(baseUrl: string, path: string) {
  const trimmed = baseUrl.replace(/\/+$/, "");
  if (trimmed.endsWith(path)) return trimmed;
  if (trimmed.endsWith("/v1")) return `${trimmed}${path}`;
  return `${trimmed}/v1${path}`;
}

function completionsUrl(baseUrl: string) {
  return apiUrl(baseUrl, "/chat/completions");
}

function modelsUrl(baseUrl: string) {
  return apiUrl(baseUrl, "/models");
}

async function chatCompletion({ baseUrl, apiKey, model, messages, temperature = 0.2 }: ChatRequest) {
  const response = await fetch(completionsUrl(baseUrl), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      messages,
      temperature,
      response_format: { type: "json_object" }
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `AI-провайдер вернул ошибку ${response.status}`);
  }

  return response.json() as Promise<{
    choices?: Array<{ message?: { content?: string } }>;
  }>;
}

export async function fetchAiModels(params: { baseUrl: string; apiKey: string }) {
  const response = await fetch(modelsUrl(params.baseUrl), {
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

  if (!settings.aiApiKey) {
    throw new Error("API-ключ нужен для проверки подключения.");
  }

  const result = await chatCompletion({
    baseUrl: settings.aiBaseUrl,
    apiKey: settings.aiApiKey,
    model: settings.aiFastModel || settings.aiPrimaryModel,
    messages: [
      {
        role: "system",
        content: "Верни только компактный JSON."
      },
      {
        role: "user",
        content: "Верни {\"ok\":true,\"message\":\"AI настроен\"}."
      }
    ],
    temperature: 0
  });

  const content = result.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("AI-провайдер вернул пустой ответ.");
  }

  return { ok: true, content };
}

export async function analyzeResumeWithAi(params: {
  baseUrl: string;
  apiKey: string;
  model: string;
  resumeText: string;
}) {
  const result = await chatCompletion({
    baseUrl: params.baseUrl,
    apiKey: params.apiKey,
    model: params.model,
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
  if (!content) {
    throw new Error("AI-провайдер вернул пустой анализ резюме.");
  }

  return resumeAnalysisSchema.parse(JSON.parse(content));
}

export async function analyzeVacancyWithAi(params: {
  baseUrl: string;
  apiKey: string;
  model: string;
  resumeText: string;
  searchProfile: {
    title?: string;
    summary?: string;
    targetRoles?: string[];
    searchQueries?: string[];
    positiveSignals?: string[];
    negativeSignals?: string[];
    stopWords?: string[];
  } | null;
  vacancy: {
    title: string;
    companyName?: string;
    source?: string;
    sourceUrl?: string;
    salaryText?: string;
    location?: string;
    workFormat?: string;
    rawDescription?: string;
  };
}) {
  const result = await chatCompletion({
    baseUrl: params.baseUrl,
    apiKey: params.apiKey,
    model: params.model,
    messages: [
      {
        role: "system",
        content:
          "Ты анализируешь вакансию для локальной Career CRM. Отвечай строго JSON на русском языке. Не придумывай опыт кандидата. Используй только факты из резюме. Если требование вакансии не подтверждено резюме, добавь его в missing_requirements. Если вакансия мутная, прямо укажи red_flags. Сопроводительное письмо короткое, деловое, человеческое, без канцелярита и без неподтверждённых фактов. Адаптируй акценты: руководящая роль — управление, самостоятельность, процессы; аналитическая роль — анализ, структурирование, работа с информацией; судебная роль — процессуальные документы, споры, претензионная работа; договорная роль — договоры, риски, контрагенты."
      },
      {
        role: "user",
        content: `Верни JSON с ключами vacancy_match_score, summary, why_matches, weak_matches, red_flags, missing_requirements, recommended_resume_angle, recommended_cover_letter_focus, should_apply, reasoning_short, suggested_next_action, cover_letter.

Резюме:
${params.resumeText}

Профиль поиска:
${JSON.stringify(params.searchProfile ?? {}, null, 2)}

Вакансия:
${JSON.stringify(params.vacancy, null, 2)}`
      }
    ],
    temperature: 0.15
  });

  const content = result.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("AI-провайдер вернул пустой анализ вакансии.");
  }

  return vacancyAnalysisSchema.parse(JSON.parse(content));
}

export async function regenerateCoverLetterWithAi(params: {
  baseUrl: string;
  apiKey: string;
  model: string;
  resumeText: string;
  vacancy: {
    title: string;
    companyName?: string | null;
    rawDescription?: string | null;
    aiAnalysisJson?: string | null;
  };
  instruction: string;
}) {
  const result = await chatCompletion({
    baseUrl: params.baseUrl,
    apiKey: params.apiKey,
    model: params.model,
    messages: [
      {
        role: "system",
        content:
          "Ты пишешь короткое сопроводительное письмо на русском языке. Не придумывай опыт, используй только факты из резюме и вакансии. Письмо должно быть деловым, живым и без канцелярита. Верни строгий JSON: {\"cover_letter\":\"...\"}."
      },
      {
        role: "user",
        content: `Инструкция по тону: ${params.instruction}

Резюме:
${params.resumeText}

Вакансия:
${JSON.stringify(params.vacancy, null, 2)}`
      }
    ],
    temperature: 0.2
  });

  const content = result.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("AI-провайдер вернул пустое письмо.");
  }

  return z.object({ cover_letter: z.string().min(1) }).parse(JSON.parse(content)).cover_letter;
}
