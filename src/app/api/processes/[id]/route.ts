import { NextResponse } from "next/server";
import { fromJsonText } from "@/lib/json";
import { prisma } from "@/lib/prisma";
import { processStatusLabel } from "@/lib/process-status";
import { isStale } from "@/lib/stale-process";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const run = await prisma.processRun.findUnique({
    where: { id },
    include: {
      logs: { orderBy: { createdAt: "desc" }, take: 100 }
    }
  });

  if (!run) {
    return NextResponse.json({ ok: false, message: "Процесс не найден." }, { status: 404 });
  }

  const effectiveStatus =
    run.status === "running" && isStale(run.updatedAt) ? "stale" : run.status;

  return NextResponse.json({
    ok: true,
    run: {
      ...run,
      status: effectiveStatus,
      statusLabel: processStatusLabel(effectiveStatus, run.updatedAt),
      metadata: fromJsonText(run.metadataJson, {}),
      result: fromJsonText(run.resultJson, null)
    },
    logs: run.logs.reverse()
  });
}
