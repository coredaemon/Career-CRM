export class AiAnalysisError extends Error {
  code: string;
  userMessage: string;
  technicalDetails?: string;

  constructor(params: { code: string; userMessage: string; technicalDetails?: string }) {
    super(params.userMessage);
    this.name = "AiAnalysisError";
    this.code = params.code;
    this.userMessage = params.userMessage;
    this.technicalDetails = params.technicalDetails;
  }
}

export const INVALID_AI_JSON_MESSAGE =
  "AI получил текст, но не смог вернуть структурированный анализ. Частая причина — модель плохо соблюдает JSON-формат или в вакансию попал мусорный текст.";

export const INVALID_VACANCY_SOURCE_MESSAGE =
  "Это не похоже на страницу вакансии. AI-анализ не запускался.";

export function sanitizeAiErrorMessage(message: string) {
  return message
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [скрыто]")
    .replace(/sk-[A-Za-z0-9]+/g, "sk-[скрыто]")
    .slice(0, 1000);
}
