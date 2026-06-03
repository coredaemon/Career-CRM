import { NextResponse } from "next/server";
import { PDFParse } from "pdf-parse";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ ok: false, message: "Загрузите PDF-файл." }, { status: 400 });
    }

    if (file.type && file.type !== "application/pdf") {
      return NextResponse.json({ ok: false, message: "Поддерживаются только PDF-файлы." }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const parser = new PDFParse({ data: buffer });
    const parsed = await parser.getText();
    await parser.destroy();
    const text = parsed.text.replace(/\n{3,}/g, "\n\n").trim();

    if (text.length < 50) {
      return NextResponse.json(
        { ok: false, message: "Не удалось извлечь текст из PDF. Скопируйте текст резюме вручную." },
        { status: 400 }
      );
    }

    return NextResponse.json({ ok: true, text });
  } catch {
    return NextResponse.json(
      { ok: false, message: "Не удалось извлечь текст из PDF. Скопируйте текст резюме вручную." },
      { status: 400 }
    );
  }
}
