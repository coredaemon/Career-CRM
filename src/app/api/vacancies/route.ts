import { NextResponse } from "next/server";
import { z } from "zod";
import { createInteraction, findOrCreateCompany, vacancyCreateData } from "@/lib/vacancy-service";
import { prisma } from "@/lib/prisma";

const vacancyDraftSchema = z.object({
  searchProfileId: z.string().optional().nullable(),
  resumeId: z.string().optional().nullable(),
  source: z.enum(["hh", "manual", "other"]),
  sourceUrl: z.string().trim().optional().nullable(),
  title: z.string().trim().min(1, "Укажите название вакансии"),
  companyName: z.string().trim().optional().nullable(),
  salaryText: z.string().trim().optional().nullable(),
  location: z.string().trim().optional().nullable(),
  workFormat: z.string().trim().optional().nullable(),
  rawDescription: z.string().trim().optional().nullable()
});

export async function POST(request: Request) {
  try {
    const draft = vacancyDraftSchema.parse(await request.json());
    const company = await findOrCreateCompany(draft.companyName);
    const vacancy = await prisma.vacancy.create({
      data: vacancyCreateData(draft, company?.id ?? null, "found")
    });

    await createInteraction({
      vacancyId: vacancy.id,
      companyId: company?.id,
      type: "vacancy_created",
      summary: "Вакансия добавлена вручную без AI-анализа."
    });

    return NextResponse.json({ ok: true, vacancy });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "Не удалось сохранить вакансию." },
      { status: 400 }
    );
  }
}
