import { NextResponse } from "next/server";
import { z } from "zod";
import { regenerateCoverLetterWithAi, vacancyAnalysisSchema } from "@/lib/ai";
import { prisma } from "@/lib/prisma";
import { getUserSettings } from "@/lib/settings";

const patchSchema = z.object({ text: z.string().min(1) });

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { text } = patchSchema.parse(await request.json());
    const vacancy = await prisma.vacancy.findUniqueOrThrow({
      where: { id },
      include: { coverLetters: { orderBy: { createdAt: "desc" }, take: 1 } }
    });
    const latest = vacancy.coverLetters[0];
    if (!latest) {
      return NextResponse.json({ ok: false, message: "Письмо не найдено." }, { status: 404 });
    }
    const updated = await prisma.coverLetter.update({ where: { id: latest.id }, data: { text } });
    return NextResponse.json({ ok: true, coverLetter: updated });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "Не удалось сохранить правки." },
      { status: 400 }
    );
  }
}

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

    if (!settings.aiConfigured) {
      return NextResponse.json({ ok: false, message: "Сначала сохраните настройки AI." }, { status: 400 });
    }

    const analysis = vacancy.aiAnalysisJson
      ? vacancyAnalysisSchema.parse(JSON.parse(vacancy.aiAnalysisJson))
      : vacancyAnalysisSchema.parse({
          vacancy_match_score: 50,
          summary: "",
          cover_letter_brief: { candidate_strengths: [], job_priorities: [], tone: body.instruction }
        });

    const result = await regenerateCoverLetterWithAi({
      resumeText: resume.originalText,
      confirmedFacts: resume.confirmedFacts,
      instruction: body.instruction,
      analysis,
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
        text: result.coverLetter,
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
