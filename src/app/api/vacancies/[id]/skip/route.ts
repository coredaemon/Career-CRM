import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { fromJsonText } from "@/lib/json";

const skipSchema = z.object({
  quickReasons: z.array(z.string()).default([]),
  comment: z.string().trim().max(2000).optional()
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = skipSchema.parse(await request.json());

    const vacancy = await prisma.vacancy.findUniqueOrThrow({
      where: { id },
      include: { company: true }
    });

    const skipReasonJson = JSON.stringify({
      quickReasons: body.quickReasons,
      comment: body.comment ?? ""
    });

    const reasonSummary = [
      body.quickReasons.length > 0 ? body.quickReasons.join(", ") : null,
      body.comment || null
    ]
      .filter(Boolean)
      .join(". ") || "Вакансия пропущена без причины.";

    const aiAnalysis = vacancy.aiAnalysisJson
      ? fromJsonText<Record<string, unknown>>(vacancy.aiAnalysisJson, {})
      : {};

    const evidenceJson = JSON.stringify({
      vacancyTitle: vacancy.title,
      companyName: vacancy.company?.name ?? null,
      quickReasons: body.quickReasons,
      userComment: body.comment ?? "",
      vacancyKeySignals: {
        salaryText: vacancy.salaryText,
        location: vacancy.location,
        workFormat: vacancy.workFormat
      },
      aiAnalysisSummary: typeof aiAnalysis.summary === "string" ? aiAnalysis.summary : ""
    });

    const suggestedRule = buildSuggestedRule(body.quickReasons, vacancy.title, aiAnalysis);

    await prisma.$transaction(async (tx) => {
      await tx.vacancy.update({
        where: { id },
        data: {
          status: "skipped",
          skipReasonJson,
          nextActionType: null,
          nextActionAt: null,
          nextActionNote: null
        }
      });

      await tx.interaction.create({
        data: {
          vacancyId: id,
          companyId: vacancy.companyId,
          type: "vacancy_rejected_by_user",
          occurredAt: new Date(),
          summary: `Вакансия отклонена пользователем. Причины: ${reasonSummary}`
        }
      });

      if (body.quickReasons.length > 0 || body.comment) {
        await tx.learningObservation.create({
          data: {
            sourceType: "vacancy_feedback",
            sourceId: id,
            description: `Пользователь отклонил вакансию «${vacancy.title}». Причины: ${reasonSummary}`,
            evidenceJson,
            suggestedRule,
            status: "draft"
          }
        });
      }
    });

    return NextResponse.json({ ok: true, message: "Вакансия скрыта." });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "Не удалось скрыть вакансию." },
      { status: 400 }
    );
  }
}

function buildSuggestedRule(
  quickReasons: string[],
  title: string,
  aiAnalysis: Record<string, unknown>
): string {
  if (quickReasons.includes("Не мой профиль") || quickReasons.includes("Нет опыта в этой специализации")) {
    const missing = Array.isArray(aiAnalysis.missing_requirements) ? aiAnalysis.missing_requirements[0] : null;
    return missing
      ? `Понижать приоритет вакансий с требованием "${missing}", если этот опыт не подтверждён резюме.`
      : `Понижать приоритет вакансий с профилем, схожим с «${title}», если необходимый опыт не подтверждён резюме.`;
  }
  if (quickReasons.includes("Мало денег")) {
    return "Понижать приоритет вакансий с зарплатой ниже ожиданий кандидата.";
  }
  if (quickReasons.includes("Продажи / холодные звонки")) {
    return "Не рекомендовать вакансии с явными признаками холодных продаж / KPI-звонков.";
  }
  if (quickReasons.includes("Тестирование до общения")) {
    return "Понижать приоритет вакансий, требующих тестирование до первого контакта с работодателем.";
  }
  if (quickReasons.includes("Мутная компания")) {
    return "Добавлять в red_flags непрозрачные компании без информации об организации.";
  }
  return `Пересмотреть приоритет вакансий, похожих на «${title}».`;
}
