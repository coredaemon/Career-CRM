import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const run = await prisma.searchRun.update({
    where: { id },
    data: {
      stopRequested: true,
      stage: "stopping"
    }
  });

  return NextResponse.json({ ok: true, run });
}
