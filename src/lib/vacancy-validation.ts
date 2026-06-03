import { isHhVacancyUrl } from "@/lib/hh-url";

export type VacancyValidationCode =
  | "NOT_HH_VACANCY_URL"
  | "SERVICE_PAGE"
  | "EMPTY_DESCRIPTION"
  | "DESCRIPTION_TOO_SHORT"
  | "COOKIE_OR_NAVIGATION_PAGE"
  | "MISSING_TITLE"
  | "MISSING_COMPANY"
  | "UNKNOWN_BAD_PAGE";

export type VacancyDraftInput = {
  title?: string | null;
  companyName?: string | null;
  source?: string | null;
  sourceUrl?: string | null;
  sourceVacancyId?: string | null;
  rawDescription?: string | null;
};

export type VacancyValidationResult = {
  ok: boolean;
  reason?: string;
  code?: VacancyValidationCode;
  warnings?: string[];
};

const BLOCKED_TITLES = new Set([
  "поиск вакансий",
  "наши вакансии",
  "вакансии",
  "hh",
  "headhunter",
  "вакансия hh"
]);

const BLOCKED_COMPANIES = new Set(["наши вакансии", "hh"]);

const COOKIE_NAV_SIGNALS = [
  "файлы cookie",
  "мы используем cookie",
  "ищу работу",
  "создать резюме",
  "войти",
  "регистрация",
  "навигация",
  "принять все",
  "настроить cookie"
];

const VACANCY_SIGNALS = [
  "обязанност",
  "требован",
  "условия",
  "опыт",
  "занятость",
  "зарплат",
  "график",
  "работодател",
  "команд",
  "навык"
];

const MIN_DESCRIPTION_LENGTH = 200;

function normalizeText(value?: string | null) {
  return value?.replace(/\s+/g, " ").trim().toLowerCase() || "";
}

function countSignals(text: string, signals: string[]) {
  const lower = text.toLowerCase();
  return signals.reduce((count, signal) => (lower.includes(signal) ? count + 1 : count), 0);
}

function looksLikeCookieOrNavigationPage(rawDescription: string) {
  const navScore = countSignals(rawDescription, COOKIE_NAV_SIGNALS);
  const vacancyScore = countSignals(rawDescription, VACANCY_SIGNALS);

  if (navScore >= 2 && vacancyScore === 0) return true;
  if (navScore >= 3 && vacancyScore <= 1) return true;

  const lower = rawDescription.toLowerCase();
  if (lower.includes("файлы cookie") && !lower.includes("обязанност") && !lower.includes("требован")) {
    return true;
  }

  return false;
}

export function validateVacancyDraft(draft: VacancyDraftInput): VacancyValidationResult {
  const warnings: string[] = [];
  const source = draft.source || "hh";
  const title = draft.title?.trim() || "";
  const companyName = draft.companyName?.trim() || "";
  const rawDescription = draft.rawDescription?.trim() || "";

  if (source === "hh") {
    if (!draft.sourceUrl || !isHhVacancyUrl(draft.sourceUrl)) {
      return {
        ok: false,
        code: "NOT_HH_VACANCY_URL",
        reason: "URL не похож на страницу вакансии hh."
      };
    }
  }

  if (!title) {
    return { ok: false, code: "MISSING_TITLE", reason: "Не удалось извлечь название вакансии." };
  }

  if (BLOCKED_TITLES.has(normalizeText(title))) {
    return {
      ok: false,
      code: "SERVICE_PAGE",
      reason: `Заголовок «${title}» похож на служебную страницу hh.`
    };
  }

  if (!companyName) {
    warnings.push("Компания не указана.");
  } else if (BLOCKED_COMPANIES.has(normalizeText(companyName))) {
    return {
      ok: false,
      code: "SERVICE_PAGE",
      reason: `Компания «${companyName}» похожа на служебную страницу hh.`
    };
  }

  if (!rawDescription) {
    return {
      ok: false,
      code: "EMPTY_DESCRIPTION",
      reason: "Не удалось извлечь описание вакансии."
    };
  }

  if (rawDescription.length < MIN_DESCRIPTION_LENGTH) {
    return {
      ok: false,
      code: "DESCRIPTION_TOO_SHORT",
      reason: "Описание вакансии слишком короткое для AI-анализа.",
      warnings
    };
  }

  if (looksLikeCookieOrNavigationPage(rawDescription)) {
    return {
      ok: false,
      code: "COOKIE_OR_NAVIGATION_PAGE",
      reason: "Описание похоже на служебный текст страницы (cookie/navigation), а не на вакансию.",
      warnings
    };
  }

  const vacancyScore = countSignals(rawDescription, VACANCY_SIGNALS);
  if (vacancyScore === 0 && source === "hh") {
    return {
      ok: false,
      code: "UNKNOWN_BAD_PAGE",
      reason: "Текст не содержит признаков описания вакансии.",
      warnings
    };
  }

  return warnings.length ? { ok: true, warnings } : { ok: true };
}

export function validationReasonToLog(code?: VacancyValidationCode, reason?: string): string {
  if (code === "NOT_HH_VACANCY_URL") return "Пропущена не вакансия: некорректный URL hh";
  if (code === "SERVICE_PAGE") return "Пропущена служебная страница hh";
  if (code === "EMPTY_DESCRIPTION" || code === "DESCRIPTION_TOO_SHORT") return "Не удалось извлечь описание вакансии";
  if (code === "COOKIE_OR_NAVIGATION_PAGE") return "Пропущена служебная страница hh (cookie/navigation)";
  return reason || "Пропущена невалидная страница";
}
