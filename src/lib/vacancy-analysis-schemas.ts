import { z } from "zod";
import type { VacancyAnalysis } from "@/lib/ai";

const maxThreeStrings = z.array(z.string()).max(3).default([]);

const resumeMatchBasisSchema = z.object({
  matched_requirements: z.array(z.string()).default([]),
  unsupported_requirements: z.array(z.string()).default([]),
  specialized_requirements_not_in_resume: z.array(z.string()).default([]),
  recommendation_reason: z.string().default("")
});

export const fastVacancyAnalysisSchema = z.object({
  score: z.coerce.number().min(0).max(100),
  should_apply: z.enum(["yes", "maybe", "no"]).default("maybe"),
  confidence: z.enum(["low", "medium", "high"]).default("medium"),
  summary: z.string().default(""),
  match_reasons: maxThreeStrings,
  red_flags: maxThreeStrings,
  missing_requirements: maxThreeStrings,
  next_action: z.string().default(""),
  salary_expectations_requested: z.boolean().default(false),
  resume_match_basis: resumeMatchBasisSchema.default({
    matched_requirements: [],
    unsupported_requirements: [],
    specialized_requirements_not_in_resume: [],
    recommendation_reason: ""
  })
});

export type FastVacancyAnalysis = z.infer<typeof fastVacancyAnalysisSchema>;

export const FAST_ANALYSIS_SCHEMA_DESCRIPTION = `{
  "score": number (0-100),
  "should_apply": "yes" | "maybe" | "no",
  "confidence": "low" | "medium" | "high",
  "summary": string,
  "match_reasons": string[] (max 3),
  "red_flags": string[] (max 3),
  "missing_requirements": string[] (max 3),
  "next_action": string,
  "salary_expectations_requested": boolean,
  "resume_match_basis": {
    "matched_requirements": string[],
    "unsupported_requirements": string[],
    "specialized_requirements_not_in_resume": string[],
    "recommendation_reason": string
  }
}`;

export function normalizeFastAnalysis(fast: FastVacancyAnalysis): VacancyAnalysis {
  return {
    vacancy_match_score: fast.score,
    confidence: fast.confidence,
    summary: fast.summary,
    why_matches: fast.match_reasons,
    weak_matches: [],
    red_flags: fast.red_flags,
    missing_requirements: fast.missing_requirements,
    recommended_resume_angle: "",
    recommended_cover_letter_focus: [],
    should_apply: fast.should_apply,
    reasoning_short: fast.next_action,
    suggested_next_action: fast.next_action,
    questions_to_clarify: [],
    avoid_claims: [],
    salary_expectations_requested: fast.salary_expectations_requested,
    resume_match_basis: fast.resume_match_basis,
    cover_letter_brief: {
      candidate_strengths: [],
      job_priorities: [],
      tone: "деловой, короткий, человеческий"
    }
  };
}

export const FULL_ANALYSIS_SCHEMA_DESCRIPTION = `vacancy_match_score, confidence, summary, why_matches, weak_matches, red_flags, missing_requirements, recommended_resume_angle, recommended_cover_letter_focus, should_apply, reasoning_short, suggested_next_action, questions_to_clarify, avoid_claims, cover_letter_brief, salary_expectations_requested, resume_match_basis`;

export const FULL_ANALYSIS_SCHEMA_JSON_DESCRIPTION = `{
  "vacancy_match_score": number (0-100),
  "confidence": "low" | "medium" | "high",
  "summary": string,
  "why_matches": string[],
  "weak_matches": string[],
  "red_flags": string[],
  "missing_requirements": string[],
  "recommended_resume_angle": string,
  "recommended_cover_letter_focus": string[],
  "should_apply": "yes" | "maybe" | "no",
  "reasoning_short": string,
  "suggested_next_action": string,
  "questions_to_clarify": string[],
  "avoid_claims": string[],
  "cover_letter_brief": {
    "candidate_strengths": string[],
    "job_priorities": string[],
    "tone": string
  },
  "salary_expectations_requested": boolean,
  "resume_match_basis": {
    "matched_requirements": string[],
    "unsupported_requirements": string[],
    "specialized_requirements_not_in_resume": string[],
    "recommendation_reason": string
  }
}`;
