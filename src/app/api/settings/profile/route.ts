import { NextResponse } from "next/server";
import { z } from "zod";
import { getUserSettings } from "@/lib/settings";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const settings = await getUserSettings();
  return NextResponse.json({
    salaryExpectationMin: settings.salaryExpectationMin ?? null,
    salaryExpectationMax: settings.salaryExpectationMax ?? null,
    salaryExpectationPreferredText: settings.salaryExpectationPreferredText ?? null,
    salaryExpectationNet: settings.salaryExpectationNet ?? true
  });
}

const profileSchema = z.object({
  salaryExpectationMin: z.coerce.number().int().min(0).nullable().optional(),
  salaryExpectationMax: z.coerce.number().int().min(0).nullable().optional(),
  salaryExpectationPreferredText: z.string().trim().max(500).nullable().optional(),
  salaryExpectationNet: z.boolean().optional()
});

export async function PATCH(request: Request) {
  try {
    const body = profileSchema.parse(await request.json());
    const settings = await getUserSettings();

    await prisma.userSettings.update({
      where: { id: settings.id },
      data: {
        salaryExpectationMin: body.salaryExpectationMin ?? null,
        salaryExpectationMax: body.salaryExpectationMax ?? null,
        salaryExpectationPreferredText: body.salaryExpectationPreferredText ?? null,
        salaryExpectationNet: body.salaryExpectationNet ?? true
      }
    });

    return NextResponse.json({ ok: true, message: "Зарплатные ожидания сохранены." });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "Не удалось сохранить настройки." },
      { status: 400 }
    );
  }
}
