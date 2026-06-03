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
  "Модель аналитика ответила не в том формате. Вакансия сохранена, но анализ не выполнен.";

export function sanitizeAiErrorMessage(message: string) {
  return message
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [скрыто]")
    .replace(/sk-[A-Za-z0-9]+/g, "sk-[скрыто]")
    .slice(0, 1000);
}
