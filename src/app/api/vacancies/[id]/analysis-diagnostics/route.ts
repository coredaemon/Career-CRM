import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const logs = await prisma.aiCallLog.findMany({
    where: { vacancyId: id },
    orderBy: { createdAt: "desc" },
    take: 20
  });

  const totalDurationMs = logs.reduce((sum, log) => sum + (log.durationMs ?? 0), 0);
  const repairUsed = logs.some((log) => log.taskType === "json_repair" && log.status === "success");
  const fallbackUsed = logs.some((log) => log.taskType === "vacancy_analysis_fallback" && log.status === "success");
  const attempts = logs.filter((log) => log.taskType === "vacancy_analysis" || log.taskType === "vacancy_analysis_fallback").length;
  const last = logs[0];

  return NextResponse.json({
    ok: true,
    diagnostics: {
      attempts,
      repairUsed,
      fallbackUsed,
      totalDurationMs,
      lastProvider: last?.provider,
      lastModel: last?.model,
      lastErrorCode: last?.status === "error" ? last.errorCode : null,
      lastDurationMs: last?.durationMs,
      calls: logs.map((log) => ({
        taskType: log.taskType,
        provider: log.provider,
        model: log.model,
        role: log.role,
        attemptNumber: log.attemptNumber,
        durationMs: log.durationMs,
        status: log.status,
        errorCode: log.errorCode,
        createdAt: log.createdAt
      }))
    }
  });
}
