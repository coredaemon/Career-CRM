import { Prisma } from "@prisma/client";
import { toJsonText } from "@/lib/json";
import { prisma } from "@/lib/prisma";

export type VacancyDraft = {
  searchProfileId?: string | null;
  resumeId?: string | null;
  source: string;
  sourceUrl?: string | null;
  title: string;
  companyName?: string | null;
  salaryText?: string | null;
  location?: string | null;
  workFormat?: string | null;
  rawDescription?: string | null;
};

export async function findOrCreateCompany(companyName?: string | null) {
  const cleanName = companyName?.trim();
  if (!cleanName) return null;

  const existing = await prisma.company.findFirst({
    where: { name: cleanName }
  });

  if (existing) return existing;

  return prisma.company.create({
    data: {
      name: cleanName,
      notes: ""
    }
  });
}

export function vacancyCreateData(draft: VacancyDraft, companyId: string | null, status: string): Prisma.VacancyCreateInput {
  return {
    searchProfile: draft.searchProfileId ? { connect: { id: draft.searchProfileId } } : undefined,
    company: companyId ? { connect: { id: companyId } } : undefined,
    title: draft.title.trim(),
    source: draft.source,
    sourceUrl: draft.sourceUrl || null,
    salaryText: draft.salaryText || null,
    location: draft.location || null,
    workFormat: draft.workFormat || null,
    rawDescription: draft.rawDescription || null,
    status
  };
}

export async function createInteraction(params: {
  vacancyId?: string | null;
  companyId?: string | null;
  applicationId?: string | null;
  type: string;
  summary: string;
  rawText?: string | null;
  aiSummary?: string | null;
}) {
  return prisma.interaction.create({
    data: {
      vacancyId: params.vacancyId || null,
      companyId: params.companyId || null,
      applicationId: params.applicationId || null,
      type: params.type,
      occurredAt: new Date(),
      summary: params.summary,
      rawText: params.rawText || null,
      aiSummary: params.aiSummary || null
    }
  });
}

export function vacancyAnalysisStorage(analysis: {
  vacancy_match_score: number;
  summary: string;
  why_matches: string[];
  red_flags: string[];
  missing_requirements: string[];
  should_apply: string;
  reasoning_short: string;
  suggested_next_action: string;
}) {
  return {
    matchScore: Math.round(analysis.vacancy_match_score),
    finalScore: Math.round(analysis.vacancy_match_score),
    aiAnalysisJson: toJsonText(analysis),
    redFlagsJson: toJsonText(analysis.red_flags),
    matchReasonsJson: toJsonText(analysis.why_matches),
    missingRequirementsJson: toJsonText(analysis.missing_requirements),
    recommendation: `${analysis.should_apply}: ${analysis.reasoning_short || analysis.suggested_next_action}`
  };
}
