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
