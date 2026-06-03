import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = (await request.json()) as {
      title?: string;
      originalText?: string;
      aiSummary?: string | null;
      confirmedFacts?: string | null;
    };

    const resume = await prisma.resume.update({
      where: { id },
      data: {
        title: body.title,
        originalText: body.originalText,
        aiSummary: body.aiSummary,
        confirmedFacts: body.confirmedFacts
      }
    });

    return NextResponse.json({ ok: true, resume });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "Не удалось сохранить резюме." },
      { status: 400 }
    );
  }
}
