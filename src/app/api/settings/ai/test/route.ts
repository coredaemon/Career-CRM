import { NextResponse } from "next/server";
import { z } from "zod";
import { chooseModelForRole, providerPreset } from "@/lib/ai-presets";
import { fetchAiModels, testAiConnection } from "@/lib/ai";
import { getUserSettings } from "@/lib/settings";

const testSchema = z.object({
  contour: z.enum(["analysis", "writer"]),
  provider: z.string().min(1),
  baseUrl: z.string().url(),
  apiKey: z.string().optional(),
  primaryModel: z.string().optional(),
  secondaryModel: z.string().optional()
});

export async function POST(request: Request) {
  try {
    const body = testSchema.parse(await request.json());
    const settings = await getUserSettings();
    const savedKey = body.contour === "analysis" ? settings.analysisApiKey : settings.writerApiKey;
    const apiKey = body.apiKey || savedKey || "";
    const preset = providerPreset(body.provider);
    const baseUrl = body.baseUrl || preset.baseUrl;
    const models = apiKey ? await fetchAiModels({ baseUrl, apiKey }) : [];
    const primaryRole = body.contour === "analysis" ? "analysis" : "writer";
    const secondaryRole = body.contour === "analysis" ? "fast" : "reviewer";
    const primaryModel = body.primaryModel || chooseModelForRole(body.provider, primaryRole, models) || preset.defaults[primaryRole] || "";
    const secondaryModel = body.secondaryModel || chooseModelForRole(body.provider, secondaryRole, models) || preset.defaults[secondaryRole] || primaryModel;

    await testAiConnection({
      aiProvider: body.provider,
      aiBaseUrl: baseUrl,
      aiApiKey: apiKey,
      aiPrimaryModel: primaryModel,
      aiFastModel: secondaryModel
    });

    return NextResponse.json({
      ok: true,
      message: "Ключ проверен. Выберите модели и сохраните настройки.",
      models,
      recommended: { primary: primaryModel, secondary: secondaryModel }
    });
  } catch (error) {
    return NextResponse.json({ ok: false, message: error instanceof Error ? error.message : "Не удалось проверить ключ." }, { status: 400 });
  }
}
