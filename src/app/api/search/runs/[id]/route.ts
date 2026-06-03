import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const run = await prisma.searchRun.findUnique({
    where: { id },
    include: {
      searchProfile: true,
      items: {
        orderBy: { createdAt: "desc" },
        include: {
          vacancy: {
            include: { company: true }
          }
        }
      }
    }
  });

  if (!run) return NextResponse.json({ ok: false, message: "Запуск не найден." }, { status: 404 });
  return NextResponse.json({ ok: true, run });
}
