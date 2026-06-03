import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { formatVacancyTitleForFollowUp } from "@/lib/vacancy-application-queue";

const actionSchema = z.object({
  action: z.enum(["applied", "skipped", "archived", "check_later"])
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { action } = actionSchema.parse(await request.json());
    const vacancy = await prisma.vacancy.findUniqueOrThrow({
      where: { id },
      include: { coverLetters: { orderBy: { createdAt: "desc" }, take: 1 } }
    });
    const nextActionAt = new Date();
    nextActionAt.setDate(nextActionAt.getDate() + 5);
    const titleForNote = formatVacancyTitleForFollowUp(vacancy.title);

    const updates = {
      applied: {
        status: "applied",
        nextActionType: "проверить ответ",
        nextActionAt,
        nextActionNote: `Проверить ответ работодателя по вакансии «${titleForNote}».`
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

    let message: string | undefined;

    if (action === "applied") {
      const latestLetter = vacancy.coverLetters[0];
      const existing = await prisma.application.findFirst({
        where: { vacancyId: vacancy.id },
        orderBy: { createdAt: "desc" }
      });

      if (existing) {
        await prisma.application.update({
          where: { id: existing.id },
          data: {
            status: "applied",
            appliedAt: new Date(),
            nextActionAt,
            resumeId: latestLetter?.resumeId ?? existing.resumeId,
            coverLetterId: latestLetter?.id ?? existing.coverLetterId,
            notes: "Отклик отправлен вручную пользователем."
          }
        });
      } else {
        await prisma.application.create({
          data: {
            vacancyId: vacancy.id,
            resumeId: latestLetter?.resumeId || null,
            coverLetterId: latestLetter?.id || null,
            status: "applied",
            appliedAt: new Date(),
            nextActionAt,
            notes: "Отклик отправлен вручную пользователем."
          }
        });
      }
      message = "Отклик отмечен как отправленный. Проверить ответ через 5 дней.";
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

    return NextResponse.json({ ok: true, vacancy: updated, message });
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
