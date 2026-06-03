import { NextResponse } from "next/server";
import { fromJsonText } from "@/lib/json";
import { prisma } from "@/lib/prisma";
import { aggregateAiDiagnostics } from "@/lib/process-queries";
import { buildProcessRunUiState } from "@/lib/process-status";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const run = await prisma.processRun.findUnique({
    where: { id },
    include: {
      logs: { orderBy: { createdAt: "desc" }, take: 100 },
      items: { orderBy: { id: "asc" } }
    }
  });

  if (!run) {
    return NextResponse.json({ ok: false, message: "Процесс не найден." }, { status: 404 });
  }

  const diagnostics = await aggregateAiDiagnostics(run.id);
  const logs = run.logs.reverse();
  const state = buildProcessRunUiState(run, {
    logs,
    diagnostics
  });

  return NextResponse.json({
    ok: true,
    run: {
      ...run,
      status: state.status,
      statusLabel: state.humanStatusLabel,
      metadata: fromJsonText(run.metadataJson, {}),
      result: fromJsonText(run.resultJson, null)
    },
    state,
    items: run.items,
    diagnostics,
    logs
  });
}
