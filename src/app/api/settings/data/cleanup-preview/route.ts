import { NextResponse } from "next/server";
import { getCleanupPreview, type CleanupType } from "@/lib/data-cleanup";
import { prisma } from "@/lib/prisma";

const allowedTypes = new Set(["untouched_vacancies", "analysis_errors", "invalid_sources", "old_runs", "full_vacancy_reset"]);

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") || "untouched_vacancies";
    if (!allowedTypes.has(type)) {
      return NextResponse.json({ ok: false, message: "Неизвестный тип очистки." }, { status: 400 });
    }

    const preview = await getCleanupPreview(prisma, type as CleanupType);
    return NextResponse.json({ ok: true, preview });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "Не удалось подготовить preview очистки." },
      { status: 400 }
    );
  }
}

