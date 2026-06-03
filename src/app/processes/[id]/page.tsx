import Link from "next/link";
import { notFound } from "next/navigation";
import { ProcessDetailClient } from "@/components/process-detail-client";
import { PageHeader } from "@/components/ui";
import { fromJsonText } from "@/lib/json";
import { prisma } from "@/lib/prisma";
import { processStatusLabel } from "@/lib/process-status";

export const dynamic = "force-dynamic";

export default async function ProcessDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const run = await prisma.processRun.findUnique({
    where: { id },
    include: { logs: { orderBy: { createdAt: "asc" } } }
  });

  if (!run) notFound();

  return (
    <>
      <PageHeader
        title={run.title}
        description={`${processStatusLabel(run.status, run.updatedAt)} · ${run.type}`}
      />
      <ProcessDetailClient
        initial={{
          id: run.id,
          status: run.status,
          title: run.title,
          description: run.description,
          progressCurrent: run.progressCurrent,
          progressTotal: run.progressTotal,
          currentStep: run.currentStep,
          startedAt: run.startedAt.toISOString(),
          finishedAt: run.finishedAt?.toISOString(),
          errorMessage: run.errorMessage,
          result: fromJsonText(run.resultJson, null),
          logs: run.logs.map((log) => ({
            id: log.id,
            level: log.level,
            message: log.message,
            createdAt: log.createdAt.toISOString()
          }))
        }}
      />
      <div className="mt-4">
        <Link href="/processes" className="text-sm underline">
          ← Все процессы
        </Link>
      </div>
    </>
  );
}
