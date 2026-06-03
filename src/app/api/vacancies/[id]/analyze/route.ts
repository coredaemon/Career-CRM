import { NextResponse } from "next/server";
import { z } from "zod";
import { parseAnalysisMode } from "@/lib/analysis-mode";
import { prisma } from "@/lib/prisma";
import { getUserSettings } from "@/lib/settings";
import { analyzeStoredVacancy } from "@/lib/vacancy-ai-workflow";

const analyzeSchema = z.object({
  resumeId: z.string().optional().nullable(),
  mode: z.enum(["fast", "full", "letters_only"]).optional().default("fast"),
  fallbackProvider: z.enum(["openai"]).optional()
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = analyzeSchema.parse(await request.json());
    const settings = await getUserSettings();
    if (!settings.aiConfigured) {
      return NextResponse.json({ ok: false, message: "Сначала сохраните настройки AI." }, { status: 400 });
    }

    if (body.fallbackProvider === "openai") {
      const writerKey = settings.writerApiKey || process.env.OPENAI_API_KEY;
      if (!writerKey) {
        return NextResponse.json(
          { ok: false, message: "OpenAI не настроен. Откройте настройки AI.", code: "OPENAI_NOT_CONFIGURED" },
          { status: 400 }
        );
      }
    }

    const vacancy = await prisma.vacancy.findUniqueOrThrow({
      where: { id },
      include: {
        searchProfile: true,
        coverLetters: { orderBy: { createdAt: "desc" }, take: 1 }
      }
    });
    const resumeId = body.resumeId || vacancy.coverLetters[0]?.resumeId || vacancy.searchProfile?.resumeId;
    if (!resumeId) {
      return NextResponse.json({ ok: false, message: "Не удалось выбрать резюме для AI-анализа." }, { status: 400 });
    }

    const result = await analyzeStoredVacancy({
      vacancyId: vacancy.id,
      resumeId,
      searchProfileId: vacancy.searchProfileId,
      mode: parseAnalysisMode(body.mode),
      forceFallbackProvider: body.fallbackProvider
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "Не удалось проанализировать вакансию." },
      { status: 400 }
    );
  }
}
