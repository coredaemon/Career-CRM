import assert from "node:assert/strict";
import test from "node:test";

const { isHhVacancyUrl } = await import("../src/lib/hh-url.ts");

const BLOCKED_TITLES = new Set(["поиск вакансий", "наши вакансии", "вакансии", "hh", "headhunter", "вакансия hh"]);
const COOKIE_NAV_SIGNALS = ["файлы cookie", "ищу работу", "создать резюме", "войти"];
const VACANCY_SIGNALS = ["обязанност", "требован", "условия", "опыт", "занятость", "зарплат"];

function looksLikeCookieOrNavigationPage(text) {
  const lower = text.toLowerCase();
  const navScore = COOKIE_NAV_SIGNALS.reduce((c, s) => (lower.includes(s) ? c + 1 : c), 0);
  const vacancyScore = VACANCY_SIGNALS.reduce((c, s) => (lower.includes(s) ? c + 1 : c), 0);
  return navScore >= 2 && vacancyScore === 0;
}

function validateDraft(draft) {
  if (draft.source === "hh" && (!draft.sourceUrl || !isHhVacancyUrl(draft.sourceUrl))) {
    return { ok: false, code: "NOT_HH_VACANCY_URL" };
  }
  if (BLOCKED_TITLES.has((draft.title || "").trim().toLowerCase())) {
    return { ok: false, code: "SERVICE_PAGE" };
  }
  if ((draft.companyName || "").trim().toLowerCase() === "наши вакансии") {
    return { ok: false, code: "SERVICE_PAGE" };
  }
  if (!draft.rawDescription) return { ok: false, code: "EMPTY_DESCRIPTION" };
  if (draft.rawDescription.length < 200) return { ok: false, code: "DESCRIPTION_TOO_SHORT" };
  if (looksLikeCookieOrNavigationPage(draft.rawDescription)) return { ok: false, code: "COOKIE_OR_NAVIGATION_PAGE" };
  return { ok: true };
}

const validDescription =
  "Обязанности: разработка backend на Python, проектирование API, code review. " +
  "Требования: опыт от 3 лет, знание Django, PostgreSQL, REST. " +
  "Условия: удалённая занятость, гибкий график, зарплата обсуждается. " +
  "Работодатель — продуктовая IT-компания с сильной инженерной культурой. ".repeat(3);

test("validateVacancyDraft rejects service page title", () => {
  const result = validateDraft({
    source: "hh",
    sourceUrl: "https://hh.ru/vacancy/123",
    title: "Поиск вакансий",
    companyName: "Acme",
    rawDescription: validDescription
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, "SERVICE_PAGE");
});

test("validateVacancyDraft rejects blocked company", () => {
  const result = validateDraft({
    source: "hh",
    sourceUrl: "https://hh.ru/vacancy/123",
    title: "Python Developer",
    companyName: "Наши вакансии",
    rawDescription: validDescription
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, "SERVICE_PAGE");
});

test("validateVacancyDraft rejects cookie/navigation rawDescription", () => {
  const cookieText =
    "Мы используем файлы cookie. Ищу работу. Создать резюме. Войти. Принять все cookie. ".repeat(10);
  const result = validateDraft({
    source: "hh",
    sourceUrl: "https://hh.ru/vacancy/123",
    title: "Python Developer",
    companyName: "Acme Corp",
    rawDescription: cookieText
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, "COOKIE_OR_NAVIGATION_PAGE");
});

test("validateVacancyDraft rejects invalid hh URL", () => {
  const result = validateDraft({
    source: "hh",
    sourceUrl: "https://hh.ru/search/vacancy/advanced",
    title: "Python Developer",
    companyName: "Acme",
    rawDescription: validDescription
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, "NOT_HH_VACANCY_URL");
});

test("validateVacancyDraft accepts valid vacancy", () => {
  const result = validateDraft({
    source: "hh",
    sourceUrl: "https://hh.ru/vacancy/12345678",
    title: "Python Developer",
    companyName: "Acme Corp",
    rawDescription: validDescription
  });
  assert.equal(result.ok, true);
});
