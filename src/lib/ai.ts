import { z } from "zod";

export const aiSettingsSchema = z.object({
  aiProvider: z.string().trim().min(1, "Укажите провайдера"),
  aiBaseUrl: z.string().trim().url("Укажите корректный base URL"),
  aiApiKey: z.string().trim().min(1, "Укажите API key").optional(),
  aiPrimaryModel: z.string().trim().min(1, "Укажите primary model"),
  aiFastModel: z.string().trim().min(1, "Укажите fast model")
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

function completionsUrl(baseUrl: string) {
  const trimmed = baseUrl.replace(/\/+$/, "");
  if (trimmed.endsWith("/chat/completions")) return trimmed;
  if (trimmed.endsWith("/v1")) return `${trimmed}/chat/completions`;
  return `${trimmed}/v1/chat/completions`;
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
    throw new Error(text || `AI request failed with status ${response.status}`);
  }

  return response.json() as Promise<{
    choices?: Array<{ message?: { content?: string } }>;
  }>;
}

export async function testAiConnection(input: z.infer<typeof aiSettingsSchema>) {
  const settings = aiSettingsSchema.parse(input);

  if (!settings.aiApiKey) {
    throw new Error("API key нужен для проверки подключения.");
  }

  const result = await chatCompletion({
    baseUrl: settings.aiBaseUrl,
    apiKey: settings.aiApiKey,
    model: settings.aiFastModel || settings.aiPrimaryModel,
    messages: [
      {
        role: "system",
        content: "Return a compact JSON object only."
      },
      {
        role: "user",
        content: "Return {\"ok\":true,\"message\":\"AI configured\"}."
      }
    ],
    temperature: 0
  });

  const content = result.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("AI provider returned an empty response.");
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
          "You analyze a resume for a local career CRM. Return strict JSON only. Derive every role, direction, query, signal, and warning only from the resume text. Do not inject preset industries, professions, or search directions."
      },
      {
        role: "user",
        content: `Analyze this resume text and return JSON with keys: profile_title, profile_summary, strengths, possible_directions, target_roles, search_queries, positive_signals, negative_signals, stop_words, cover_letter_tone, warnings.\n\nResume:\n${params.resumeText}`
      }
    ],
    temperature: 0.15
  });

  const content = result.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("AI provider returned an empty resume analysis.");
  }

  const parsed = JSON.parse(content);
  return resumeAnalysisSchema.parse(parsed);
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
          "Ты анализируешь вакансию для локальной Career CRM. Отвечай строго JSON на русском языке. Не придумывай опыт кандидата. Используй только факты из резюме. Если требование вакансии не подтверждено резюме, добавь его в missing_requirements. Если вакансия мутная, прямо укажи red_flags. Сопроводительное письмо короткое, деловое, человеческое, без канцелярита и без неподтвержденных фактов. Адаптируй акценты: руководящая роль — управление, самостоятельность, процессы; аналитическая роль — анализ, структурирование, работа с информацией; судебная роль — процессуальные документы, споры, претензионная работа; договорная роль — договоры, риски, контрагенты."
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
    throw new Error("AI provider returned an empty vacancy analysis.");
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
    throw new Error("AI provider returned an empty cover letter.");
  }

  return z.object({ cover_letter: z.string().min(1) }).parse(JSON.parse(content)).cover_letter;
}
