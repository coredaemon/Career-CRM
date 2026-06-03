import { NextResponse } from "next/server";
import { analyzeResumeWithAi } from "@/lib/ai";
import { getUserSettings } from "@/lib/settings";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      resumeText?: string;
      aiApiKey?: string;
      aiBaseUrl?: string;
      aiPrimaryModel?: string;
    };

    if (!body.resumeText || body.resumeText.trim().length < 200) {
      return NextResponse.json(
        { ok: false, message: "Вставьте текст резюме. Для анализа нужно хотя бы 200 символов." },
        { status: 400 }
      );
    }

    const settings = await getUserSettings();
    const baseUrl = body.aiBaseUrl || settings.aiBaseUrl || process.env.AI_BASE_URL || "";
    const apiKey = body.aiApiKey || settings.aiApiKey || process.env.AI_API_KEY || "";
    const model = body.aiPrimaryModel || settings.aiPrimaryModel || process.env.AI_PRIMARY_MODEL || "";

    if (!baseUrl || !apiKey || !model) {
      return NextResponse.json(
        { ok: false, message: "Сначала настройте AI: выберите провайдера, проверьте ключ и сохраните модели." },
        { status: 400 }
      );
    }

    const analysis = await analyzeResumeWithAi({
      baseUrl,
      apiKey,
      model,
      resumeText: body.resumeText
    });

    return NextResponse.json({ ok: true, analysis });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "Не удалось проанализировать резюме." },
      { status: 400 }
    );
  }
}
