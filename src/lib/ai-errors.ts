export type AiAnalysisDiagnostics = {
  attempts: number;
  repairUsed: boolean;
  fallbackUsed: boolean;
  totalDurationMs: number;
  lastProvider?: string;
  lastModel?: string;
  errorCode?: string;
};

export class AiAnalysisError extends Error {
  code: string;
  userMessage: string;
  technicalDetails?: string;
  diagnostics?: AiAnalysisDiagnostics;

  constructor(params: {
    code: string;
    userMessage: string;
    technicalDetails?: string;
    diagnostics?: AiAnalysisDiagnostics;
  }) {
    super(params.userMessage);
    this.name = "AiAnalysisError";
    this.code = params.code;
    this.userMessage = params.userMessage;
    this.technicalDetails = params.technicalDetails;
    this.diagnostics = params.diagnostics;
  }
}

export const INVALID_AI_JSON_MESSAGE =
  "AI не смог разобрать вакансию в структурированном формате. Возможные причины: модель не соблюдает JSON, текст вакансии слишком шумный или API ответил нестабильно.";

export const INVALID_VACANCY_SOURCE_MESSAGE =
  "Это не похоже на страницу вакансии. AI-анализ не запускался.";

export function sanitizeAiErrorMessage(message: string) {
  return message
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [скрыто]")
    .replace(/sk-[A-Za-z0-9]+/g, "sk-[скрыто]")
    .slice(0, 1000);
}
