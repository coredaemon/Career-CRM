export type AiTaskRole = "analysis" | "writer" | "reviewer" | "premium" | "fast";

export type AiProviderId = "openai" | "deepseek" | "compatible";

export type AiProviderPreset = {
  id: AiProviderId;
  title: string;
  description: string;
  baseUrl: string;
  defaults: Partial<Record<AiTaskRole, string>>;
};

export const providerPresets: AiProviderPreset[] = [
  {
    id: "deepseek",
    title: "DeepSeek",
    description: "Экономичный аналитический провайдер для JSON-разбора, score и массовой обработки.",
    baseUrl: "https://api.deepseek.com/v1",
    defaults: {
      analysis: "deepseek-v4-flash",
      fast: "deepseek-v4-flash",
      premium: "deepseek-v4-pro"
    }
  },
  {
    id: "openai",
    title: "OpenAI",
    description: "Качественный пользовательский слой для писем, объяснений и проверки спорных решений.",
    baseUrl: "https://api.openai.com/v1",
    defaults: {
      writer: "gpt-5.4-mini",
      reviewer: "gpt-5.4-mini",
      premium: "gpt-5.4"
    }
  },
  {
    id: "compatible",
    title: "OpenAI-совместимый API",
    description: "Для OpenRouter, локальных шлюзов и других совместимых сервисов.",
    baseUrl: "",
    defaults: {}
  }
];

export function providerPreset(provider: string | null | undefined) {
  return providerPresets.find((item) => item.id === provider) ?? providerPresets[0];
}

export function chooseModelForRole(provider: string, role: AiTaskRole, models: string[]) {
  const preset = providerPreset(provider);
  const fallback = preset.defaults[role] ?? models[0] ?? "";
  const lower = models.map((model) => model.toLowerCase());

  function findExactOrFuzzy(candidates: string[]) {
    for (const candidate of candidates) {
      const exact = lower.findIndex((model) => model === candidate.toLowerCase());
      if (exact >= 0) return models[exact];
    }
    for (const candidate of candidates) {
      const fuzzy = lower.findIndex((model) => model.includes(candidate.toLowerCase()));
      if (fuzzy >= 0) return models[fuzzy];
    }
    return "";
  }

  if (provider === "deepseek") {
    return findExactOrFuzzy(["deepseek-v4-flash", "deepseek-chat"]) || fallback;
  }

  if (provider === "openai") {
    if (role === "writer" || role === "reviewer") {
      return findExactOrFuzzy(["gpt-5.4-mini", "gpt-4.1-mini", "gpt-4o-mini"]) || fallback;
    }
    return findExactOrFuzzy(["gpt-5.4", "gpt-4.1", "gpt-4o"]) || fallback;
  }

  return fallback;
}
