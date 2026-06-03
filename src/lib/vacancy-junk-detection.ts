import { prisma } from "@/lib/prisma";
import { validateVacancyDraft } from "@/lib/vacancy-validation";

export type JunkVacancyCandidate = {
  id: string;
  title: string;
  sourceUrl: string | null;
  companyName: string | null;
  reason: string;
  code?: string;
};

const JUNK_TITLE_PATTERNS = ["поиск вакансий", "вакансия hh"];
const JUNK_COMPANY_PATTERNS = ["наши вакансии"];
const JUNK_URL_PATTERNS = ["/search/vacancy/advanced", "/search/vacancy"];

export function detectJunkVacancy(vacancy: {
  title: string;
  source: string;
  sourceUrl?: string | null;
  sourceVacancyId?: string | null;
  rawDescription?: string | null;
  company?: { name: string | null } | null;
  companyName?: string | null;
}): { isJunk: boolean; reason?: string; code?: string } {
  const titleLower = vacancy.title.trim().toLowerCase();
  const companyName = (vacancy.company?.name || vacancy.companyName || "").trim().toLowerCase();
  const sourceUrl = vacancy.sourceUrl || "";

  if (JUNK_TITLE_PATTERNS.some((pattern) => titleLower === pattern)) {
    return { isJunk: true, reason: `Подозрительный заголовок: «${vacancy.title}»`, code: "SERVICE_PAGE" };
  }

  if (JUNK_COMPANY_PATTERNS.some((pattern) => companyName === pattern)) {
    return { isJunk: true, reason: `Подозрительная компания: «${vacancy.company?.name || vacancy.companyName}»`, code: "SERVICE_PAGE" };
  }

  if (JUNK_URL_PATTERNS.some((pattern) => sourceUrl.includes(pattern))) {
    return { isJunk: true, reason: "URL ведёт на страницу поиска hh, а не на вакансию.", code: "NOT_HH_VACANCY_URL" };
  }

  const validation = validateVacancyDraft({
    title: vacancy.title,
    companyName: vacancy.company?.name || vacancy.companyName,
    source: vacancy.source,
    sourceUrl: vacancy.sourceUrl,
    sourceVacancyId: vacancy.sourceVacancyId,
    rawDescription: vacancy.rawDescription
  });

  if (!validation.ok) {
    return { isJunk: true, reason: validation.reason, code: validation.code };
  }

  return { isJunk: false };
}

export async function findJunkVacancies(limit = 100): Promise<JunkVacancyCandidate[]> {
  const vacancies = await prisma.vacancy.findMany({
    where: {
      status: { notIn: ["invalid_source", "archived"] },
      OR: [
        { title: { in: ["Поиск вакансий", "Вакансия hh"] } },
        { sourceUrl: { contains: "/search/vacancy" } },
        { company: { name: "Наши вакансии" } }
      ]
    },
    include: { company: true },
    take: limit,
    orderBy: { createdAt: "desc" }
  });

  const results: JunkVacancyCandidate[] = [];
  const seen = new Set<string>();

  for (const vacancy of vacancies) {
    const detection = detectJunkVacancy(vacancy);
    if (detection.isJunk && !seen.has(vacancy.id)) {
      seen.add(vacancy.id);
      results.push({
        id: vacancy.id,
        title: vacancy.title,
        sourceUrl: vacancy.sourceUrl,
        companyName: vacancy.company?.name || null,
        reason: detection.reason || "Служебная страница hh, не вакансия",
        code: detection.code
      });
    }
  }

  // Also scan recent hh vacancies with validation heuristics
  const recentHh = await prisma.vacancy.findMany({
    where: {
      source: "hh",
      status: { notIn: ["invalid_source", "archived"] },
      id: { notIn: [...seen] }
    },
    include: { company: true },
    take: limit,
    orderBy: { createdAt: "desc" }
  });

  for (const vacancy of recentHh) {
    const detection = detectJunkVacancy(vacancy);
    if (detection.isJunk && !seen.has(vacancy.id)) {
      seen.add(vacancy.id);
      results.push({
        id: vacancy.id,
        title: vacancy.title,
        sourceUrl: vacancy.sourceUrl,
        companyName: vacancy.company?.name || null,
        reason: detection.reason || "Служебная страница hh, не вакансия",
        code: detection.code
      });
    }
  }

  return results;
}

export async function markVacanciesAsInvalidSource(vacancyIds: string[]) {
  if (!vacancyIds.length) return { updated: 0 };

  const result = await prisma.vacancy.updateMany({
    where: { id: { in: vacancyIds } },
    data: {
      status: "invalid_source",
      analysisErrorCode: "INVALID_VACANCY_SOURCE",
      analysisErrorMessage: "Служебная страница hh, не вакансия"
    }
  });

  return { updated: result.count };
}
