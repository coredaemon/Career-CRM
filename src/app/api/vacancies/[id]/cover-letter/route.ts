import { NextResponse } from "next/server";
import { z } from "zod";
import { regenerateCoverLetterWithAi } from "@/lib/ai";
import { prisma } from "@/lib/prisma";
import { getUserSettings } from "@/lib/settings";

const regenerateSchema = z.object({
  resumeId: z.string().min(1),
  instruction: z.string().trim().min(1)
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = regenerateSchema.parse(await request.json());
    const [settings, vacancy, resume] = await Promise.all([
      getUserSettings(),
      prisma.vacancy.findUniqueOrThrow({ where: { id }, include: { company: true } }),
      prisma.resume.findUniqueOrThrow({ where: { id: body.resumeId } })
    ]);

    const baseUrl = settings.aiBaseUrl || process.env.AI_BASE_URL || "";
    const apiKey = settings.aiApiKey || process.env.AI_API_KEY || "";
    const model = settings.aiPrimaryModel || process.env.AI_PRIMARY_MODEL || "";

    if (!baseUrl || !apiKey || !model) {
      return NextResponse.json(
        { ok: false, message: "Сначала сохраните настройки AI: провайдер, API-ключ и модели." },
        { status: 400 }
      );
    }

    const text = await regenerateCoverLetterWithAi({
      baseUrl,
      apiKey,
      model,
      resumeText: resume.originalText,
      instruction: body.instruction,
      vacancy: {
        title: vacancy.title,
        companyName: vacancy.company?.name,
        rawDescription: vacancy.rawDescription,
        aiAnalysisJson: vacancy.aiAnalysisJson
      }
    });

    const coverLetter = await prisma.coverLetter.create({
      data: {
        vacancyId: vacancy.id,
        resumeId: resume.id,
        text,
        style: body.instruction
      }
    });

    await prisma.interaction.create({
      data: {
        vacancyId: vacancy.id,
        companyId: vacancy.companyId,
        type: "cover_letter_created",
        occurredAt: new Date(),
        summary: `Сопроводительное письмо перегенерировано: ${body.instruction}.`
      }
    });

    return NextResponse.json({ ok: true, coverLetter });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "Не удалось перегенерировать письмо." },
      { status: 400 }
    );
  }
}
