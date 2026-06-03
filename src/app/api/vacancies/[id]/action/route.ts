import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const actionSchema = z.object({
  action: z.enum(["applied", "skipped", "archived", "check_later"])
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { action } = actionSchema.parse(await request.json());
    const vacancy = await prisma.vacancy.findUniqueOrThrow({ where: { id }, include: { coverLetters: true } });
    const nextActionAt = new Date();
    nextActionAt.setDate(nextActionAt.getDate() + 5);

    const updates = {
      applied: {
        status: "applied",
        nextActionType: "проверить ответ",
        nextActionAt,
        nextActionNote: "Проверить ответ после ручного отклика."
      },
      skipped: {
        status: "skipped",
        nextActionType: null,
        nextActionAt: null,
        nextActionNote: null
      },
      archived: {
        status: "archived",
        nextActionType: null,
        nextActionAt: null,
        nextActionNote: null
      },
      check_later: {
        status: vacancy.status,
        nextActionType: "проверить позже",
        nextActionAt,
        nextActionNote: "Вернуться к вакансии и принять решение."
      }
    }[action];

    const updated = await prisma.vacancy.update({
      where: { id },
      data: updates
    });

    if (action === "applied") {
      await prisma.application.create({
        data: {
          vacancyId: vacancy.id,
          resumeId: vacancy.coverLetters[0]?.resumeId || null,
          coverLetterId: vacancy.coverLetters[0]?.id || null,
          status: "applied",
          appliedAt: new Date(),
          nextActionAt,
          notes: "Отклик отправлен вручную пользователем."
        }
      });
    }

    await prisma.interaction.create({
      data: {
        vacancyId: vacancy.id,
        companyId: vacancy.companyId,
        type: action === "applied" ? "application_sent_manually" : "status_changed",
        occurredAt: new Date(),
        summary: actionLabel(action)
      }
    });

    return NextResponse.json({ ok: true, vacancy: updated });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "Не удалось выполнить действие." },
      { status: 400 }
    );
  }
}

function actionLabel(action: string) {
  if (action === "applied") return "Отклик отправлен вручную.";
  if (action === "skipped") return "Вакансия пропущена.";
  if (action === "archived") return "Вакансия отправлена в архив.";
  return "Вакансию нужно проверить позже.";
}
