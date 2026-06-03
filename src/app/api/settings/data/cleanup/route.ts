import { NextResponse } from "next/server";
import { applyCleanup, type CleanupMode, type CleanupType } from "@/lib/data-cleanup";
import { prisma } from "@/lib/prisma";

const allowedTypes = new Set(["untouched_vacancies", "analysis_errors", "invalid_sources", "old_runs", "full_vacancy_reset"]);
const allowedModes = new Set(["archive", "delete"]);

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      type?: CleanupType;
      mode?: CleanupMode;
      confirmText?: string;
      includeDraftLearningObservations?: boolean;
    };

    if (!body.type || !allowedTypes.has(body.type)) {
      return NextResponse.json({ ok: false, message: "Неизвестный тип очистки." }, { status: 400 });
    }
    if (!body.mode || !allowedModes.has(body.mode)) {
      return NextResponse.json({ ok: false, message: "Выберите режим очистки: архивировать или удалить." }, { status: 400 });
    }

    const result = await applyCleanup(prisma, {
      type: body.type,
      mode: body.mode,
      confirmText: body.confirmText || "",
      includeDraftLearningObservations: Boolean(body.includeDraftLearningObservations)
    });

    return NextResponse.json({ ok: true, result });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "Не удалось выполнить очистку." },
      { status: 400 }
    );
  }
}

