import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const actionSchema = z.object({
  action: z.enum(["responded", "rejected", "no_response", "follow_up", "archived"])
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { action } = actionSchema.parse(await request.json());
    const application = await prisma.application.findUniqueOrThrow({
      where: { id },
      include: { vacancy: true }
    });

    const vacancyUpdates: Record<string, unknown> = {};
    const applicationUpdates: Record<string, unknown> = {};

    if (action === "responded") {
      vacancyUpdates.status = "waiting_response";
      applicationUpdates.status = "responded";
      applicationUpdates.responseAt = new Date();
      vacancyUpdates.nextActionType = null;
      vacancyUpdates.nextActionAt = null;
      vacancyUpdates.nextActionNote = null;
    } else if (action === "rejected") {
      vacancyUpdates.status = "rejected";
      applicationUpdates.status = "rejected";
      applicationUpdates.responseAt = new Date();
      applicationUpdates.outcome = "rejected";
      vacancyUpdates.nextActionType = null;
      vacancyUpdates.nextActionAt = null;
      vacancyUpdates.nextActionNote = null;
    } else if (action === "no_response") {
      vacancyUpdates.status = "no_response";
      applicationUpdates.status = "no_response";
      applicationUpdates.outcome = "no_response";
      vacancyUpdates.nextActionType = "написать follow-up";
      const followUpAt = new Date();
      followUpAt.setDate(followUpAt.getDate() + 3);
      vacancyUpdates.nextActionAt = followUpAt;
      vacancyUpdates.nextActionNote = "Написать follow-up работодателю.";
      applicationUpdates.nextActionAt = followUpAt;
    } else if (action === "follow_up") {
      vacancyUpdates.nextActionType = "написать follow-up";
      const followUpAt = new Date();
      followUpAt.setDate(followUpAt.getDate() + 1);
      vacancyUpdates.nextActionAt = followUpAt;
      vacancyUpdates.nextActionNote = "Подготовить и отправить follow-up вручную.";
      applicationUpdates.nextActionAt = followUpAt;
    } else if (action === "archived") {
      vacancyUpdates.status = "archived";
      applicationUpdates.status = "archived";
      vacancyUpdates.nextActionType = null;
      vacancyUpdates.nextActionAt = null;
      vacancyUpdates.nextActionNote = null;
    }

    await prisma.$transaction([
      prisma.vacancy.update({
        where: { id: application.vacancyId },
        data: vacancyUpdates
      }),
      prisma.application.update({
        where: { id: application.id },
        data: applicationUpdates
      }),
      prisma.interaction.create({
        data: {
          vacancyId: application.vacancyId,
          companyId: application.vacancy.companyId,
          type: "status_changed",
          occurredAt: new Date(),
          summary: applicationActionLabel(action)
        }
      })
    ]);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "Не удалось выполнить действие." },
      { status: 400 }
    );
  }
}

function applicationActionLabel(action: string) {
  const labels: Record<string, string> = {
    responded: "Работодатель ответил.",
    rejected: "Получен отказ.",
    no_response: "Ответа нет — запланирован follow-up.",
    follow_up: "Запланирован follow-up.",
    archived: "Отклик отправлен в архив."
  };
  return labels[action] ?? "Статус отклика обновлён.";
}
