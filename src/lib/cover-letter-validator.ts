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

function isManagerial(ctx: ValidationContext): boolean {
  const text = [ctx.vacancyTitle, ...(ctx.vacancyKeyTasks ?? [])].join(" ");
  return MANAGERIAL_PATTERNS.test(text);
}

function isContractFocused(ctx: ValidationContext): boolean {
  const text = [ctx.vacancyTitle, ...(ctx.vacancyKeyTasks ?? []), ...(ctx.matchedRequirements ?? [])].join(" ");
  return CONTRACT_PATTERNS.test(text);
}

function isLitigationFocused(ctx: ValidationContext): boolean {
  const text = [ctx.vacancyTitle, ...(ctx.vacancyKeyTasks ?? []), ...(ctx.matchedRequirements ?? [])].join(" ");
  return LITIGATION_PATTERNS.test(text);
}

/**
 * Validates a generated cover letter text and returns a list of warnings.
 * Pure function — no I/O, no Prisma.
 */
export function validateCoverLetterText(
  text: string,
  ctx: ValidationContext = {}
): CoverLetterWarning[] {
  const warnings: CoverLetterWarning[] = [];
  const lower = text.toLowerCase();

  // --- KPI mention ---
  if (/\bkpi\b/i.test(text) && !isManagerial(ctx)) {
    warnings.push({
      code: "irrelevant_kpi",
      level: "warn",
      message:
        "Письмо содержит KPI, но вакансия не управленческая и не процессная. KPI лучше убрать или заменить на конкретный результат."
    });
  }

  // --- Contract speed / timing ---
  if (
    (lower.includes("сроки") || lower.includes("сократил")) &&
    (lower.includes("договор") || lower.includes("согласован")) &&
    !isContractFocused(ctx)
  ) {
    warnings.push({
      code: "irrelevant_contract_speed",
      level: "warn",
      message:
        "Письмо упоминает сокращение сроков согласования договоров, но вакансия не связана с договорным потоком. Лучше убрать или заменить на более релевантный факт."
    });
  }

  // --- Pretrial / litigation stats ---
  if (
    (lower.includes("досудеб") || lower.includes("претензи") || lower.includes("исков")) &&
    !isLitigationFocused(ctx)
  ) {
    warnings.push({
      code: "irrelevant_litigation",
      level: "warn",
      message:
        "Письмо содержит факты о досудебном урегулировании, но вакансия не претензионно-судебная. Лучше убрать или заменить."
    });
  }

  // --- "Сейчас я руковожу" framing ---
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

  // --- Employer / company names ---
  // Heuristic: if a phrase like "в компании X" or "работая в X" appears, warn.
  // Note: \b word boundaries don't work with Cyrillic in JS, use simple patterns.
  if (/в компании|работая в|работал в|работаю в/i.test(text)) {
    warnings.push({
      code: "employer_name_mention",
      level: "warn",
      message:
        "Письмо упоминает прошлого работодателя. Лучше писать об опыте и задачах, не называя компании."
    });
  }

  // --- Work format promises ---
  if (/удалённ|удаленн|офисн|гибрид|командировк/i.test(text)) {
    warnings.push({
      code: "work_format_promise",
      level: "warn",
      message:
        "Письмо упоминает формат работы (удалёнка, офис, гибрид). Лучше заменить на «готов обсудить условия и формат работы»."
    });
  }

  // --- Letter too long ---
  if (text.length > 1200) {
    warnings.push({
      code: "too_long",
      level: "warn",
      message: `Письмо слишком длинное (${text.length} символов). Рекомендуем не более 1200 символов — 3–5 предложений.`
    });
  }

  // --- Missing salary phrase when requested ---
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
