import { z } from "zod";
import { type AiRouterContext, callAiRouter, logAiCallError, logAiCallSuccess, resolveAiRoute } from "@/lib/ai-router";
import { AiTaskRole } from "@/lib/ai-presets";
import { extractJsonFromAiResponse } from "@/lib/extract-json";
import { AI_REPAIR_TIMEOUT_MS } from "@/lib/process-status";
import { FAST_ANALYSIS_SCHEMA_DESCRIPTION } from "@/lib/vacancy-analysis-schemas";

export async function repairAiJson(params: {
  rawText: string;
  schema: z.ZodTypeAny;
  schemaDescription: string;
  context?: AiRouterContext;
  signal?: AbortSignal;
}): Promise<{ value: unknown; meta: { provider: string; model: string; role: string }; durationMs: number } | null> {
  const reviewerRoute = await resolveAiRoute("reviewer");
  const writerRoute = await resolveAiRoute("writer");
  if (!reviewerRoute.apiKey && !writerRoute.apiKey) {
    return null;
  }
  const role: AiTaskRole = reviewerRoute.apiKey ? "reviewer" : "writer";
  const startedAt = new Date();

  try {
    const result = await callAiRouter({
      role,
      taskType: "json_repair",
      messages: [
        {
          role: "system",
          content: "Исправь текст ниже в валидный JSON строго по схеме. Не добавляй пояснений, markdown или code block."
        },
        {
          role: "user",
          content: `Схема:\n${params.schemaDescription}\n\nТекст для исправления:\n${params.rawText.slice(0, 8000)}`
        }
      ],
      responseFormat: "json",
      temperature: 0,
      timeoutMs: AI_REPAIR_TIMEOUT_MS,
      signal: params.signal,
      context: params.context,
      deferSuccessLog: true
    });

    const jsonText = extractJsonFromAiResponse(result.content);
    if (!jsonText) {
      await logAiCallError({
        taskType: "json_repair",
        provider: result.provider,
        model: result.model,
        role,
        errorCode: "INVALID_AI_JSON",
        errorMessage: "Repair не смог вернуть валидный JSON.",
        context: params.context,
        startedAt,
        finishedAt: new Date(),
        durationMs: result.durationMs
      });
      return null;
    }

    const value = params.schema.parse(JSON.parse(jsonText));
    const finishedAt = new Date();
    await logAiCallSuccess({
      taskType: "json_repair",
      provider: result.provider,
      model: result.model,
      role,
      usage: result.usage,
      context: params.context,
      startedAt,
      finishedAt
    });

    return {
      value,
      meta: { provider: result.provider, model: result.model, role },
      durationMs: finishedAt.getTime() - startedAt.getTime()
    };
  } catch {
    return null;
  }
}

export { FAST_ANALYSIS_SCHEMA_DESCRIPTION };
