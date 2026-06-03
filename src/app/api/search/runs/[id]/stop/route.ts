import { NextResponse } from "next/server";
import { abortProcess } from "@/lib/process-abort-registry";
import { prisma } from "@/lib/prisma";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  abortProcess(id);
  const run = await prisma.searchRun.update({
    where: { id },
    data: {
      stopRequested: true,
      stage: "stopping"
    }
  });

  return NextResponse.json({ ok: true, run });
}
