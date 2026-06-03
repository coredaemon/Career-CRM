const JUNK_TITLE_PATTERNS = [/^(first|фирст|firсt)$/i, /^test$/i, /^—+$/, /^\.+$/];

export const COVER_LETTER_SCORE_THRESHOLD = 70;

export function formatVacancyTitleForFollowUp(title: string | null | undefined): string {
  const trimmed = (title ?? "").trim();
  if (!trimmed || JUNK_TITLE_PATTERNS.some((pattern) => pattern.test(trimmed))) {
    return "интересующую вакансию";
  }
  if (trimmed.length <= 120) return trimmed;
  return `${trimmed.slice(0, 117).trimEnd()}…`;
}

export function isEligibleForCoverLetter(params: {
  status: string;
  matchScore: number | null;
  aiAnalysisJson: string | null;
  hasLetter: boolean;
  isInvalid?: boolean;
}): boolean {
  if (params.isInvalid) return false;
  if (params.hasLetter) return false;
  if (!params.aiAnalysisJson) return false;
  if (params.status === "invalid_source" || params.status === "skipped_invalid" || params.status === "analysis_error") {
    return false;
  }
  if (params.status === "rejected_by_ai" || params.status === "archived" || params.status === "applied") {
    return false;
  }
  if (params.status === "ai_recommended" || params.status === "ready_to_apply" || params.status === "needs_review") {
    return true;
  }
  return (params.matchScore ?? 0) >= COVER_LETTER_SCORE_THRESHOLD;
}

export function isReadyToApplyQueueItem(params: { status: string; hasLetter: boolean }): boolean {
  if (!params.hasLetter) return false;
  return params.status === "ready_to_apply" || params.status === "ai_recommended";
}

export function statusAfterCoverLetterCreated(
  analysis: { should_apply: "yes" | "maybe" | "no"; vacancy_match_score: number },
  currentStatus: string
): "ready_to_apply" | null {
  if (analysis.should_apply === "no") return null;
  const score = analysis.vacancy_match_score;
  const recommended =
    currentStatus === "ai_recommended" ||
    currentStatus === "ready_to_apply" ||
    analysis.should_apply === "yes" ||
    score >= COVER_LETTER_SCORE_THRESHOLD;
  if (!recommended) return null;
  return "ready_to_apply";
}

export function isEligibleForBulkCoverLetter(params: {
  status: string;
  matchScore: number | null;
  aiAnalysisJson: string | null;
  hasLetter: boolean;
}): boolean {
  if (params.hasLetter) return false;
  if (!params.aiAnalysisJson) return false;
  if (params.status === "analysis_error" || params.status === "invalid_source" || params.status === "skipped_invalid") {
    return false;
  }
  if (params.status === "ai_recommended" || params.status === "ready_to_apply") return true;
  if (params.status === "needs_review" && (params.matchScore ?? 0) >= COVER_LETTER_SCORE_THRESHOLD) return true;
  return (params.matchScore ?? 0) >= COVER_LETTER_SCORE_THRESHOLD;
}

export function recommendedWithoutLetterWhere() {
  return {
    status: { notIn: ["invalid_source", "skipped_invalid", "analysis_error", "archived", "applied", "rejected_by_ai"] },
    aiAnalysisJson: { not: null },
    coverLetters: { none: {} },
    OR: [
      { status: "ai_recommended" },
      { status: "ready_to_apply" },
      { status: "needs_review", matchScore: { gte: COVER_LETTER_SCORE_THRESHOLD } },
      { matchScore: { gte: COVER_LETTER_SCORE_THRESHOLD } }
    ]
  };
}

export function readyToApplyTabWhere() {
  return {
    OR: [
      { status: "ready_to_apply", coverLetters: { some: {} } },
      { status: "ai_recommended", coverLetters: { some: {} } }
    ]
  };
}

export function readyWithLetterWhere() {
  return readyToApplyTabWhere();
}
