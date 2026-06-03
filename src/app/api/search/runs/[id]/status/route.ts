import { NextResponse } from "next/server";
import { fromJsonText } from "@/lib/json";
import { prisma } from "@/lib/prisma";
import {
  effectiveSearchRunStatus,
  minutesSinceUpdate,
  searchRunStatusLabel,
  searchStageLabel
} from "@/lib/process-status";
import { isStale } from "@/lib/stale-process";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const run = await prisma.searchRun.findUnique({
    where: { id },
    include: { searchProfile: { select: { title: true } } }
  });

  if (!run) {
    return NextResponse.json({ ok: false, message: "Запуск не найден." }, { status: 404 });
  }

  const effectiveStatus = effectiveSearchRunStatus(run.status, run.updatedAt);
  const progress = fromJsonText<Record<string, number>>(run.progressJson, {});
  const logs = fromJsonText<string[]>(run.logJson, []);
  const stale = effectiveStatus === "stale" || (run.status === "running" && isStale(run.updatedAt));

  return NextResponse.json({
    ok: true,
    run: {
      id: run.id,
      status: effectiveStatus,
      rawStatus: run.status,
      statusLabel: searchRunStatusLabel(effectiveStatus, run.updatedAt),
      stage: run.stage,
      stageLabel: searchStageLabel(run.stage),
      currentQuery: run.currentQuery,
      currentQueryIndex: run.currentQueryIndex,
      totalQueries: run.totalQueries,
      stopRequested: run.stopRequested,
      startedAt: run.startedAt,
      finishedAt: run.finishedAt,
      updatedAt: run.updatedAt,
      profileTitle: run.searchProfile?.title,
      totalFound: run.totalFound,
      totalCreated: run.totalCreated,
      totalDuplicates: run.totalDuplicates,
      totalAnalyzed: run.totalAnalyzed,
      totalErrors: run.totalErrors,
      totalRecommended: run.totalRecommended,
      totalAnalysisErrors: run.totalAnalysisErrors,
      totalCoverLetters: run.totalCoverLetters,
      errorCode: run.errorCode,
      errorMessage: run.errorMessage
    },
    progress,
    logs: logs.slice(-80),
    isStale: stale,
    minutesSinceUpdate: minutesSinceUpdate(run.updatedAt),
    isActive: effectiveStatus === "running" || effectiveStatus === "queued"
  });
}
