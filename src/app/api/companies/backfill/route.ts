import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST() {
  try {
    const created = 0;
    let linked = 0;

    // Strategy 1: vacancies without companyId that share an employerUrl
    // with a vacancy that already has a companyId — link them to the same company.
    const unlinked = await prisma.vacancy.findMany({
      where: { companyId: null, employerUrl: { not: null } },
      select: { id: true, employerUrl: true }
    });

    for (const vacancy of unlinked) {
      if (!vacancy.employerUrl) continue;
      const sibling = await prisma.vacancy.findFirst({
        where: {
          employerUrl: vacancy.employerUrl,
          companyId: { not: null }
        },
        select: { companyId: true }
      });
      if (sibling?.companyId) {
        await prisma.vacancy.update({
          where: { id: vacancy.id },
          data: { companyId: sibling.companyId }
        });
        linked++;
      }
    }

    // Strategy 2: vacancies without companyId and without employerUrl
    // Try to match company name from the company field stored in searchRunItems
    // by looking at the interactions log for "vacancy_created" event with a companyId hint.
    const stillUnlinked = await prisma.vacancy.findMany({
      where: { companyId: null },
      select: {
        id: true,
        interactions: {
          where: { type: "vacancy_created", companyId: { not: null } },
          select: { companyId: true },
          take: 1
        }
      }
    });

    for (const vacancy of stillUnlinked) {
      const interactionCompanyId = vacancy.interactions[0]?.companyId;
      if (interactionCompanyId) {
        await prisma.vacancy.update({
          where: { id: vacancy.id },
          data: { companyId: interactionCompanyId }
        });
        linked++;
      }
    }

    // Strategy 3: ensure all companies have correct vacancy counts
    // (no DB action needed — counts are computed live from relations)

    return NextResponse.json({ ok: true, created, linked });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "Ошибка при создании компаний." },
      { status: 500 }
    );
  }
}
