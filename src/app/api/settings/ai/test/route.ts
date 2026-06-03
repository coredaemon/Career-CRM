import { NextResponse } from "next/server";
import { chooseRecommendedModels, fetchAiModels, getAiProviderPreset, testAiConnection } from "@/lib/ai";
import { getUserSettings } from "@/lib/settings";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const preset = getAiProviderPreset(body.aiProvider);

    if (!preset.enabled) {
      return NextResponse.json(
        { ok: false, message: "Этот провайдер пока недоступен в текущей версии CareerOS." },
        { status: 400 }
      );
    }

    const settings = await getUserSettings();
    const apiKey = body.aiApiKey || settings.aiApiKey || "";
    const baseUrl = body.aiBaseUrl || preset.baseUrl;
    const models = apiKey && baseUrl ? await fetchAiModels({ baseUrl, apiKey }) : [];
    const recommended = chooseRecommendedModels(body.aiProvider, models);
    const aiPrimaryModel = body.aiPrimaryModel || recommended.primary || preset.defaultPrimaryModel;
    const aiFastModel = body.aiFastModel || recommended.fast || preset.defaultFastModel || aiPrimaryModel;

    const result = await testAiConnection({
      aiProvider: body.aiProvider,
      aiBaseUrl: baseUrl,
      aiApiKey: apiKey,
      aiPrimaryModel,
      aiFastModel
    });

    return NextResponse.json({
      ok: true,
      message: "Ключ проверен. Выберите модели и сохраните настройки.",
      providerResponse: result.content,
      baseUrl,
      models,
      recommended: {
        primary: aiPrimaryModel,
        fast: aiFastModel
      }
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "Не удалось проверить ключ." },
      { status: 400 }
    );
  }
}
