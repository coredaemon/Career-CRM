import { z } from "zod";
import type { VacancyAnalysis } from "@/lib/ai";

const maxThreeStrings = z.array(z.string()).max(3).default([]);

export const fastVacancyAnalysisSchema = z.object({
  score: z.coerce.number().min(0).max(100),
  should_apply: z.enum(["yes", "maybe", "no"]).default("maybe"),
  confidence: z.enum(["low", "medium", "high"]).default("medium"),
  summary: z.string().default(""),
  match_reasons: maxThreeStrings,
  red_flags: maxThreeStrings,
  missing_requirements: maxThreeStrings,
  next_action: z.string().default("")
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
  "next_action": string
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
    cover_letter_brief: {
      candidate_strengths: [],
      job_priorities: [],
      tone: "деловой, короткий, человеческий"
    }
  };
}

export const FULL_ANALYSIS_SCHEMA_DESCRIPTION = `vacancy_match_score, confidence, summary, why_matches, weak_matches, red_flags, missing_requirements, recommended_resume_angle, recommended_cover_letter_focus, should_apply, reasoning_short, suggested_next_action, questions_to_clarify, avoid_claims, cover_letter_brief`;
