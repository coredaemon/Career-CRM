import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { markProcessRunStopped } from "@/lib/process-run-service";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const run = await prisma.processRun.findUnique({ where: { id } });
  if (!run) {
    return NextResponse.json({ ok: false, message: "Процесс не найден." }, { status: 404 });
  }
  if (run.status !== "stale") {
    return NextResponse.json({ ok: false, message: "Пометить можно только зависший процесс." }, { status: 400 });
  }
  await markProcessRunStopped(id, "marked_stale");
  return NextResponse.json({ ok: true });
}
