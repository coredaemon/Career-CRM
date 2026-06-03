import { NextResponse } from "next/server";
import { z } from "zod";
import { findJunkVacancies, markVacanciesAsInvalidSource } from "@/lib/vacancy-junk-detection";

const schema = z.object({
  action: z.enum(["scan", "mark"]),
  vacancyIds: z.array(z.string()).optional()
});

export async function POST(request: Request) {
  try {
    const body = schema.parse(await request.json());

    if (body.action === "scan") {
      const candidates = await findJunkVacancies();
      return NextResponse.json({ ok: true, candidates, count: candidates.length });
    }

    const ids = body.vacancyIds?.length ? body.vacancyIds : (await findJunkVacancies()).map((item) => item.id);
    const result = await markVacanciesAsInvalidSource(ids);
    return NextResponse.json({ ok: true, ...result, markedIds: ids });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "Не удалось обработать мусорные вакансии." },
      { status: 400 }
    );
  }
}
