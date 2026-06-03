import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const body = (await request.json()) as { title?: string; originalText?: string };

  if (!body.title || !body.originalText) {
    return NextResponse.json({ ok: false, message: "Укажите название и текст резюме." }, { status: 400 });
  }

  const resume = await prisma.resume.create({
    data: {
      title: body.title,
      sourceType: "text",
      originalText: body.originalText
    }
  });

  return NextResponse.json({ ok: true, resume });
}
