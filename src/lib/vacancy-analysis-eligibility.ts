import { isHhVacancyUrl } from "@/lib/hh-url";
import { validateVacancyDraft } from "@/lib/vacancy-validation";

export const BULK_EXCLUDED_STATUSES = ["invalid_source", "skipped_invalid", "archived", "applied"] as const;

type VacancyLike = {
  title: string;
  source: string;
  sourceUrl?: string | null;
  sourceVacancyId?: string | null;
  rawDescription?: string | null;
  company?: { name: string | null } | null;
  companyName?: string | null;
};

export function isVacancyValidForAnalysis(vacancy: VacancyLike) {
  if (vacancy.source === "hh" && vacancy.sourceUrl && !isHhVacancyUrl(vacancy.sourceUrl)) {
    return validateVacancyDraft({
      title: vacancy.title,
      companyName: vacancy.company?.name ?? vacancy.companyName,
      source: vacancy.source,
      sourceUrl: vacancy.sourceUrl,
      sourceVacancyId: vacancy.sourceVacancyId,
      rawDescription: vacancy.rawDescription
    });
  }

  return validateVacancyDraft({
    title: vacancy.title,
    companyName: vacancy.company?.name ?? vacancy.companyName,
    source: vacancy.source,
    sourceUrl: vacancy.sourceUrl,
    sourceVacancyId: vacancy.sourceVacancyId,
    rawDescription: vacancy.rawDescription
  });
}

export function shouldWriteCoverLetterForStatus(status: string) {
  return status === "ai_recommended" || status === "ready_to_apply";
}
