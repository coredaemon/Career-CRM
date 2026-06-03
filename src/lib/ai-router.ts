import { AiAnalysisError } from "@/lib/ai-errors";
import { sanitizeAiErrorMessage } from "@/lib/ai-errors";
import { isResponseFormatError, supportsJsonMode } from "@/lib/ai-json-mode";
import { isAbortError } from "@/lib/process-abort-registry";
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
  timeoutMs?: number;
  signal?: AbortSignal;
  explicitRoute?: RouteConfig;
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
  durationMs?: number;
};

export type RouteConfig = {
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

function combineSignals(timeoutMs: number, external?: AbortSignal): AbortSignal {
  const timeoutSignal = AbortSignal.timeout(timeoutMs);
  if (!external) return timeoutSignal;
  if (typeof AbortSignal.any === "function") {
    return AbortSignal.any([timeoutSignal, external]);
  }
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (timeoutSignal.aborted || external.aborted) {
    abort();
  } else {
    timeoutSignal.addEventListener("abort", abort, { once: true });
    external.addEventListener("abort", abort, { once: true });
  }
  return controller.signal;
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

export async function resolveFallbackAnalysisRoute(): Promise<RouteConfig | null> {
  const settings = await getUserSettings();
  const provider = settings.writerProvider || process.env.AI_WRITER_PROVIDER || "openai";
  if (provider !== "openai") return null;
  const preset = providerPreset(provider);
  const apiKey = settings.writerApiKey || process.env.OPENAI_API_KEY || "";
  const model = settings.reviewerModel || process.env.AI_REVIEWER_MODEL || preset.defaults.reviewer || "";
  const baseUrl = settings.writerBaseUrl || process.env.AI_WRITER_BASE_URL || preset.baseUrl;
  if (!apiKey || !model || !baseUrl) return null;
  return { provider, baseUrl, apiKey, model };
}

async function fetchChatCompletion(params: {
  route: RouteConfig;
  messages: AiRouterRequest["messages"];
  temperature: number;
  responseFormat?: "json" | "text";
  signal: AbortSignal;
}) {
  const useJsonMode = params.responseFormat === "json" && supportsJsonMode(params.route.provider);

  async function doFetch(withJsonMode: boolean) {
    const response = await fetch(apiUrl(params.route.baseUrl, "/chat/completions"), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${params.route.apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: params.route.model,
        messages: params.messages,
        temperature: params.temperature,
        response_format: withJsonMode ? { type: "json_object" } : undefined
      }),
      signal: params.signal
    });
    return response;
  }

  let response = await doFetch(useJsonMode);
  if (!response.ok && useJsonMode) {
    const text = await response.text();
    if (isResponseFormatError(response.status, text)) {
      response = await doFetch(false);
    } else {
      throw new Error(text || `AI-провайдер вернул ошибку ${response.status}`);
    }
  }

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `AI-провайдер вернул ошибку ${response.status}`);
  }

  return response.json() as Promise<{
    choices?: Array<{ message?: { content?: string } }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
  }>;
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
  const route = request.explicitRoute ?? (await resolveAiRoute(request.role));
  if (!route.baseUrl || !route.apiKey || !route.model) {
    throw new Error("Для выбранной роли AI не настроены провайдер, ключ или модель.");
  }

  const startedAt = new Date();
  const timeoutMs = request.timeoutMs ?? AI_TIMEOUT_MS;
  const signal = combineSignals(timeoutMs, request.signal);

  try {
    const data = await fetchChatCompletion({
      route,
      messages: request.messages,
      temperature: request.temperature ?? 0.2,
      responseFormat: request.responseFormat,
      signal
    });

    const content = data.choices?.[0]?.message?.content ?? "";
    const usage = data.usage
      ? {
          inputTokens: data.usage.prompt_tokens,
          outputTokens: data.usage.completion_tokens,
          totalTokens: data.usage.total_tokens
        }
      : undefined;

    const finishedAt = new Date();
    const durationMs = finishedAt.getTime() - startedAt.getTime();
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

    return {
      content,
      provider: route.provider,
      model: route.model,
      role: request.role,
      usage,
      logId,
      durationMs
    };
  } catch (error) {
    const finishedAt = new Date();
    const durationMs = finishedAt.getTime() - startedAt.getTime();

    if (isAbortError(error)) {
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
          errorCode: "ABORTED_BY_USER",
          errorMessage: "Запрос прерван пользователем",
          startedAt,
          finishedAt,
          durationMs
        }
      });
      throw new AiAnalysisError({
        code: "ABORTED_BY_USER",
        userMessage: "Анализ прерван пользователем."
      });
    }

    const isTimeout = error instanceof Error && error.name === "TimeoutError";
    const errorCode = isTimeout ? "AI_TIMEOUT" : "PROVIDER_ERROR";
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
        errorCode,
        errorMessage: message,
        startedAt,
        finishedAt,
        durationMs
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
  startedAt?: Date;
  finishedAt?: Date;
  durationMs?: number;
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
      errorMessage: sanitizeAiErrorMessage(params.errorMessage),
      startedAt: params.startedAt,
      finishedAt: params.finishedAt,
      durationMs: params.durationMs
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
