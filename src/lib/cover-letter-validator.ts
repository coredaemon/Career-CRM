export type CoverLetterWarning = {
  code: string;
  level: "critical" | "warn";
  message: string;
};

export type ValidationContext = {
  /** Vacancy title used to guess vacancy type */
  vacancyTitle?: string;
  /** Key tasks / priorities extracted from AI analysis */
  vacancyKeyTasks?: string[];
  /** Whether the vacancy explicitly asked for salary expectations */
  salaryExpectationsRequested?: boolean;
  /** Preferred salary text from user settings */
  salaryPreferredText?: string | null;
  /** Matched requirements from AI analysis (used to determine relevance) */
  matchedRequirements?: string[];
};

// Patterns that suggest the vacancy is managerial / process-focused
const MANAGERIAL_PATTERNS =
  /руковод|управлен|менеджер|директор|начальник|team\s*lead|тимлид|head\s+of|нач\.\s+отдел/i;

// Patterns that suggest the vacancy involves contract drafting/review flow
const CONTRACT_PATTERNS =
  /договор|контракт|согласован|оформлен|сделк/i;

// Patterns that suggest the vacancy is litigation / claims focused
const LITIGATION_PATTERNS =
  /суд|претензи|иск|арбитраж|спор|взыскан|досудеб/i;

// Patterns that indicate management language used in a letter
const MANAGEMENT_IN_LETTER_PATTERNS =
  /руководил\s+отдел|управлял\s+отдел|руководил\s+команд|управлял\s+команд|руководил\s+юридическ|руководство\s+отдел|управление\s+отдел|руководство\s+команд|возглавлял\s+отдел|возглавлял\s+команд/i;

export function isManagerial(ctx: ValidationContext): boolean {
  const text = [ctx.vacancyTitle, ...(ctx.vacancyKeyTasks ?? [])].join(" ");
  return MANAGERIAL_PATTERNS.test(text);
}

export function isContractFocused(ctx: ValidationContext): boolean {
  const text = [ctx.vacancyTitle, ...(ctx.vacancyKeyTasks ?? []), ...(ctx.matchedRequirements ?? [])].join(" ");
  return CONTRACT_PATTERNS.test(text);
}

export function isLitigationFocused(ctx: ValidationContext): boolean {
  const text = [ctx.vacancyTitle, ...(ctx.vacancyKeyTasks ?? []), ...(ctx.matchedRequirements ?? [])].join(" ");
  return LITIGATION_PATTERNS.test(text);
}

/**
 * Validates a generated cover letter text and returns a list of warnings.
 * Pure function — no I/O, no Prisma.
 *
 * Levels:
 *   critical — triggers automatic re-generation; shown with ⚠ in the UI
 *   warn     — surfaced to the user but does not trigger auto-regeneration
 */
export function validateCoverLetterText(
  text: string,
  ctx: ValidationContext = {}
): CoverLetterWarning[] {
  const warnings: CoverLetterWarning[] = [];
  const lower = text.toLowerCase();

  // --- KPI mention (critical: irrelevant metric for non-managerial role) ---
  if (/\bkpi\b/i.test(text) && !isManagerial(ctx)) {
    warnings.push({
      code: "irrelevant_kpi",
      level: "critical",
      message:
        "Письмо содержит KPI, но вакансия не управленческая и не процессная. KPI нужно убрать или заменить на конкретный результат."
    });
  }

  // --- Contract speed / timing (critical: not relevant unless vacancy is contract-flow) ---
  if (
    (lower.includes("сроки") || lower.includes("сократил")) &&
    (lower.includes("договор") || lower.includes("согласован")) &&
    !isContractFocused(ctx)
  ) {
    warnings.push({
      code: "irrelevant_contract_speed",
      level: "critical",
      message:
        "Письмо упоминает сокращение сроков согласования договоров, но вакансия не связана с договорным потоком. Нужно убрать или заменить на более релевантный факт."
    });
  }

  // --- Pretrial / litigation stats (critical: not relevant unless vacancy is litigation-focused) ---
  if (
    (lower.includes("досудеб") || lower.includes("претензи") || lower.includes("исков")) &&
    !isLitigationFocused(ctx)
  ) {
    warnings.push({
      code: "irrelevant_litigation",
      level: "critical",
      message:
        "Письмо содержит факты о досудебном урегулировании или претензиях, но вакансия не претензионно-судебная. Нужно убрать или заменить."
    });
  }

  // --- General management mention (critical: misleads employer if role is not managerial) ---
  if (MANAGEMENT_IN_LETTER_PATTERNS.test(text) && !isManagerial(ctx)) {
    warnings.push({
      code: "irrelevant_management",
      level: "critical",
      message:
        "Письмо упоминает руководство отделом или командой, но вакансия не руководящая. Лучше убрать или переформулировать: «есть опыт работы в условиях …»."
    });
  }

  // --- "Сейчас я руковожу" framing (critical: active leadership framing for non-managerial role) ---
  if (
    (lower.includes("сейчас я руковожу") || lower.includes("сейчас руковожу") || lower.includes("в настоящее время руковожу")) &&
    !isManagerial(ctx)
  ) {
    warnings.push({
      code: "irrelevant_current_leadership",
      level: "critical",
      message:
        "Письмо пишет «сейчас я руковожу...», но вакансия не руководящая. Это может насторожить работодателя. Лучше: «есть опыт руководства [функцией]»."
    });
  }

  // --- Employer / company names (critical: exposes unnecessary detail) ---
  if (/в компании|работая в|работал в|работаю в/i.test(text)) {
    warnings.push({
      code: "employer_name_mention",
      level: "critical",
      message:
        "Письмо упоминает прошлого работодателя по названию или контексту. Лучше писать об опыте и задачах, не называя компании."
    });
  }

  // --- Work format promises (warn: unconfirmed commitment) ---
  if (/удалённ|удаленн|офисн|гибрид|командировк/i.test(text)) {
    warnings.push({
      code: "work_format_promise",
      level: "warn",
      message:
        "Письмо упоминает формат работы (удалёнка, офис, гибрид). Лучше заменить на «готов обсудить условия и формат работы»."
    });
  }

  // --- Letter too long (warn: readability issue) ---
  if (text.length > 1200) {
    warnings.push({
      code: "too_long",
      level: "warn",
      message: `Письмо слишком длинное (${text.length} символов). Рекомендуем не более 1200 символов — 3–5 предложений.`
    });
  }

  // --- Missing salary phrase when requested (warn: missed employer expectation) ---
  if (
    ctx.salaryExpectationsRequested &&
    ctx.salaryPreferredText &&
    !lower.includes("зарплат") &&
    !lower.includes("ожидани") &&
    !lower.includes("тыс") &&
    !lower.includes("рублей")
  ) {
    warnings.push({
      code: "missing_salary",
      level: "warn",
      message:
        "Работодатель просит зарплатные ожидания, и у вас заполнена формулировка в настройках, но письмо её не содержит."
    });
  }

  return warnings;
}

export function hasCriticalWarnings(warnings: CoverLetterWarning[]): boolean {
  return warnings.some((w) => w.level === "critical");
}

/**
 * Maps a warning code to a short human-readable description of the forbidden fragment.
 * Used when building forbiddenFragments for auto-regeneration or UI action.
 */
export function warningToForbiddenFragment(warning: CoverLetterWarning): string {
  const map: Record<string, string> = {
    irrelevant_kpi: "KPI и процессные метрики",
    irrelevant_contract_speed: "сокращение сроков согласования договоров",
    irrelevant_litigation: "досудебное урегулирование, претензии, судебные споры",
    irrelevant_management: "руководство отделом, управление командой",
    irrelevant_current_leadership: "фраза «сейчас я руковожу»",
    employer_name_mention: "упоминания прошлых работодателей",
    work_format_promise: "обещания формата работы (удалёнка, офис, гибрид)",
  };
  return map[warning.code] ?? warning.message;
}
