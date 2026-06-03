import { AiAnalysisError } from "@/lib/ai-errors";
import { sanitizeAiErrorMessage } from "@/lib/ai-errors";
import { AI_TIMEOUT_MS } from "@/lib/process-status";
import { prisma } from "@/lib/prisma";
import { getUserSettings } from "@/lib/settings";
import { AiTaskRole, providerPreset } from "@/lib/ai-presets";

export type AiRouterContext = {
  vacancyId?: string;
  processRunId?: string;
  attemptNumber?: number;
};

export type AiRouterRequest = {
  role: AiTaskRole;
  taskType: string;
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
  temperature?: number;
  responseFormat?: "json" | "text";
  context?: AiRouterContext;
  deferSuccessLog?: boolean;
};

export type AiRouterResponse = {
  content: string;
  provider: string;
  model: string;
  role: AiTaskRole;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
  };
  logId?: string;
};

type RouteConfig = {
  provider: string;
  baseUrl: string;
  apiKey: string;
  model: string;
};

function apiUrl(baseUrl: string, path: string) {
  const trimmed = baseUrl.replace(/\/+$/, "");
  if (trimmed.endsWith(path)) return trimmed;
  if (trimmed.endsWith("/v1")) return `${trimmed}${path}`;
  return `${trimmed}/v1${path}`;
}

function keyFromEnv(provider: string, role: AiTaskRole) {
  if (role === "analysis" || role === "fast") return process.env.DEEPSEEK_API_KEY || process.env.AI_API_KEY || "";
  if (provider === "openai") return process.env.OPENAI_API_KEY || process.env.AI_API_KEY || "";
  return process.env.AI_API_KEY || "";
}

export async function resolveAiRoute(role: AiTaskRole): Promise<RouteConfig> {
  const settings = await getUserSettings();

  if (role === "analysis" || role === "fast") {
    const provider = settings.analysisProvider || process.env.AI_ANALYSIS_PROVIDER || settings.aiProvider || "deepseek";
    const preset = providerPreset(provider);
    return {
      provider,
      baseUrl: settings.analysisBaseUrl || process.env.AI_ANALYSIS_BASE_URL || settings.aiBaseUrl || preset.baseUrl,
      apiKey: settings.analysisApiKey || keyFromEnv(provider, role),
      model:
        role === "fast"
          ? settings.fastModel || process.env.AI_FAST_MODEL || preset.defaults.fast || ""
          : settings.analysisModel || process.env.AI_ANALYSIS_MODEL || preset.defaults.analysis || ""
    };
  }

  const provider = settings.writerProvider || process.env.AI_WRITER_PROVIDER || settings.aiProvider || "openai";
  const preset = providerPreset(provider);
  return {
    provider,
    baseUrl: settings.writerBaseUrl || process.env.AI_WRITER_BASE_URL || settings.aiBaseUrl || preset.baseUrl,
    apiKey: settings.writerApiKey || keyFromEnv(provider, role),
    model:
      role === "reviewer"
        ? settings.reviewerModel || process.env.AI_REVIEWER_MODEL || preset.defaults.reviewer || ""
        : settings.writerModel || process.env.AI_WRITER_MODEL || preset.defaults.writer || ""
  };
}

export async function logAiCallSuccess(params: {
  taskType: string;
  provider: string;
  model: string;
  role: AiTaskRole;
  usage?: AiRouterResponse["usage"];
  context?: AiRouterContext;
  startedAt: Date;
  finishedAt: Date;
}) {
  const durationMs = params.finishedAt.getTime() - params.startedAt.getTime();
  return prisma.aiCallLog.create({
    data: {
      taskType: params.taskType,
      provider: params.provider,
      model: params.model,
      role: params.role,
      vacancyId: params.context?.vacancyId,
      processRunId: params.context?.processRunId,
      attemptNumber: params.context?.attemptNumber ?? 1,
      inputTokens: params.usage?.inputTokens,
      outputTokens: params.usage?.outputTokens,
      totalTokens: params.usage?.totalTokens,
      estimatedCostUsd: null,
      status: "success",
      startedAt: params.startedAt,
      finishedAt: params.finishedAt,
      durationMs
    }
  });
}

export async function callAiRouter(request: AiRouterRequest): Promise<AiRouterResponse> {
  const route = await resolveAiRoute(request.role);
  if (!route.baseUrl || !route.apiKey || !route.model) {
    throw new Error("Для выбранной роли AI не настроены провайдер, ключ или модель.");
  }

  const startedAt = new Date();

  try {
    const response = await fetch(apiUrl(route.baseUrl, "/chat/completions"), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${route.apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: route.model,
        messages: request.messages,
        temperature: request.temperature ?? 0.2,
        response_format: request.responseFormat === "json" ? { type: "json_object" } : undefined
      }),
      signal: AbortSignal.timeout(AI_TIMEOUT_MS)
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || `AI-провайдер вернул ошибку ${response.status}`);
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
    };
    const content = data.choices?.[0]?.message?.content ?? "";
    const usage = data.usage
      ? {
          inputTokens: data.usage.prompt_tokens,
          outputTokens: data.usage.completion_tokens,
          totalTokens: data.usage.total_tokens
        }
      : undefined;

    const finishedAt = new Date();
    let logId: string | undefined;

    if (!request.deferSuccessLog) {
      const log = await logAiCallSuccess({
        taskType: request.taskType,
        provider: route.provider,
        model: route.model,
        role: request.role,
        usage,
        context: request.context,
        startedAt,
        finishedAt
      });
      logId = log.id;
    }

    return { content, provider: route.provider, model: route.model, role: request.role, usage, logId };
  } catch (error) {
    const finishedAt = new Date();
    const isTimeout = error instanceof Error && error.name === "TimeoutError";
    const errorCode = isTimeout ? "AI_TIMEOUT" : undefined;
    const message = isTimeout
      ? "AI не ответил за отведённое время"
      : sanitizeAiErrorMessage(error instanceof Error ? error.message : "Неизвестная ошибка AI");

    await prisma.aiCallLog.create({
      data: {
        taskType: request.taskType,
        provider: route.provider,
        model: route.model,
        role: request.role,
        vacancyId: request.context?.vacancyId,
        processRunId: request.context?.processRunId,
        attemptNumber: request.context?.attemptNumber ?? 1,
        status: "error",
        errorCode: errorCode ?? (error instanceof Error && "code" in error ? String((error as { code?: string }).code) : undefined),
        errorMessage: message,
        startedAt,
        finishedAt,
        durationMs: finishedAt.getTime() - startedAt.getTime()
      }
    });

    if (isTimeout) {
      throw new AiAnalysisError({
        code: "AI_TIMEOUT",
        userMessage: "AI не ответил вовремя. Вакансия сохранена, анализ можно повторить позже."
      });
    }

    throw error instanceof Error ? new Error(message) : error;
  }
}

export async function logAiCallError(params: {
  taskType: string;
  provider: string;
  model: string;
  role: AiTaskRole;
  errorCode: string;
  errorMessage: string;
  context?: AiRouterContext;
}) {
  await prisma.aiCallLog.create({
    data: {
      taskType: params.taskType,
      provider: params.provider,
      model: params.model,
      role: params.role,
      vacancyId: params.context?.vacancyId,
      processRunId: params.context?.processRunId,
      attemptNumber: params.context?.attemptNumber,
      status: "error",
      errorCode: params.errorCode,
      errorMessage: sanitizeAiErrorMessage(params.errorMessage)
    }
  });
}

export async function fetchProviderModels(baseUrl: string, apiKey: string) {
  const response = await fetch(apiUrl(baseUrl, "/models"), {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    }
  });

  if (!response.ok) return [];
  const data = (await response.json()) as { data?: Array<{ id?: string }> };
  return (data.data ?? []).map((item) => item.id).filter((id): id is string => Boolean(id)).sort();
}
