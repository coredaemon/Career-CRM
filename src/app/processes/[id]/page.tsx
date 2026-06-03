import Link from "next/link";
import { notFound } from "next/navigation";
import { ProcessDetailClient } from "@/components/process-detail-client";
import { PageHeader } from "@/components/ui";
import { prisma } from "@/lib/prisma";
import { buildProcessRunUiState } from "@/lib/process-status";

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
        description={`${buildProcessRunUiState(run).humanStatusLabel} · ${run.type}`}
      />
      <ProcessDetailClient initial={{ id: run.id, status: run.status, title: run.title }} />
      <div className="mt-4">
        <Link href="/processes" className="text-sm underline">
          ← Все процессы
        </Link>
      </div>
    </>
  );
}
