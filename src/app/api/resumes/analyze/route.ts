import { NextResponse } from "next/server";
import { analyzeResumeWithAi } from "@/lib/ai";
import { getUserSettings } from "@/lib/settings";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      resumeId?: string;
      resumeText?: string;
      aiApiKey?: string;
      aiBaseUrl?: string;
      aiPrimaryModel?: string;
      save?: boolean;
    };

    if (!body.resumeText || body.resumeText.trim().length < 200) {
      return NextResponse.json(
        { ok: false, message: "Вставьте текст резюме. Для анализа нужно хотя бы 200 символов." },
        { status: 400 }
      );
    }

    const settings = await getUserSettings();
    const baseUrl = body.aiBaseUrl || settings.writerBaseUrl || settings.aiBaseUrl || process.env.AI_WRITER_BASE_URL || process.env.AI_BASE_URL || "";
    const apiKey = body.aiApiKey || settings.writerApiKey || settings.aiApiKey || process.env.OPENAI_API_KEY || process.env.AI_API_KEY || "";
    const model = body.aiPrimaryModel || settings.writerModel || settings.aiPrimaryModel || process.env.AI_WRITER_MODEL || process.env.AI_PRIMARY_MODEL || "";

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

    if (body.save && body.resumeId) {
      await prisma.resume.update({
        where: { id: body.resumeId },
        data: { aiSummary: JSON.stringify(analysis, null, 2) }
      });
    }

    return NextResponse.json({ ok: true, analysis });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "Не удалось проанализировать резюме." },
      { status: 400 }
    );
  }
}
