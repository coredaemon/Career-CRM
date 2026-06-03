import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    title?: string;
    originalText?: string;
    sourceType?: "text" | "file";
    sourceFileName?: string | null;
    confirmedFacts?: string | null;
    makeActive?: boolean;
  };

  if (!body.title || !body.originalText) {
    return NextResponse.json({ ok: false, message: "Укажите название и текст резюме." }, { status: 400 });
  }
  const title = body.title;
  const originalText = body.originalText;

  const resume = await prisma.$transaction(async (tx) => {
    const existingActive = await tx.resume.findFirst({ where: { isActive: true, isArchived: false }, select: { id: true } });
    const makeActive = body.makeActive ?? !existingActive;

    if (makeActive) {
      await tx.resume.updateMany({ data: { isActive: false } });
    }

    return tx.resume.create({
      data: {
        title,
        sourceType: body.sourceType === "file" ? "file" : "text",
        sourceFileName: body.sourceFileName || null,
        originalText,
        confirmedFacts: body.confirmedFacts || null,
        isActive: makeActive
      }
    });
  });

  return NextResponse.json({ ok: true, resume });
}
