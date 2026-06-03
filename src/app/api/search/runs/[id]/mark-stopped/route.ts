import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const run = await prisma.searchRun.findUnique({ where: { id } });
  if (!run) {
    return NextResponse.json({ ok: false, message: "Запуск не найден." }, { status: 404 });
  }

  if (!["running", "stale", "queued"].includes(run.status)) {
    return NextResponse.json({ ok: false, message: "Запуск уже завершён." }, { status: 400 });
  }

  const updated = await prisma.searchRun.update({
    where: { id },
    data: {
      status: "stopped",
      stage: "stopped",
      finishedAt: run.finishedAt ?? new Date(),
      errorMessage: run.errorMessage || "Остановлено пользователем вручную."
    }
  });

  return NextResponse.json({ ok: true, run: updated });
}
