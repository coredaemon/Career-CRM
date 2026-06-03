import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { vacancyStatuses } from "@/lib/vacancy-status";

const statusSchema = z.object({
  status: z.enum(vacancyStatuses)
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { status } = statusSchema.parse(await request.json());
    const previous = await prisma.vacancy.findUniqueOrThrow({ where: { id } });

    const vacancy = await prisma.vacancy.update({
      where: { id },
      data: { status }
    });

    await prisma.interaction.create({
      data: {
        vacancyId: vacancy.id,
        companyId: vacancy.companyId,
        type: "status_changed",
        occurredAt: new Date(),
        summary: `Статус изменён: ${previous.status} → ${status}.`
      }
    });

    return NextResponse.json({ ok: true, vacancy });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "Не удалось изменить статус." },
      { status: 400 }
    );
  }
}
