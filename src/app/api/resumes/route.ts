import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    title?: string;
    originalText?: string;
    sourceType?: "text" | "file";
    sourceFileName?: string | null;
    confirmedFacts?: string | null;
  };

  if (!body.title || !body.originalText) {
    return NextResponse.json({ ok: false, message: "Укажите название и текст резюме." }, { status: 400 });
  }

  const resume = await prisma.resume.create({
    data: {
      title: body.title,
      sourceType: body.sourceType === "file" ? "file" : "text",
      sourceFileName: body.sourceFileName || null,
      originalText: body.originalText,
      confirmedFacts: body.confirmedFacts || null
    }
  });

  return NextResponse.json({ ok: true, resume });
}
