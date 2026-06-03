import assert from "node:assert/strict";
import test from "node:test";

const { extractHhVacancyId, isHhVacancyUrl, normalizeHhVacancyUrl } = await import("../src/lib/hh-url.ts");

test("extractHhVacancyId from standard vacancy URL", () => {
  assert.equal(extractHhVacancyId("https://hh.ru/vacancy/12345678"), "12345678");
  assert.equal(extractHhVacancyId("https://hh.ru/vacancy/12345678?query=foo"), "12345678");
});

test("extractHhVacancyId from applicant response URL", () => {
  assert.equal(
    extractHhVacancyId("https://hh.ru/applicant/vacancy_response?vacancyId=9876543"),
    "9876543"
  );
});

test("isHhVacancyUrl rejects search and service pages", () => {
  assert.equal(isHhVacancyUrl("https://hh.ru/search/vacancy/advanced"), false);
  assert.equal(isHhVacancyUrl("https://hh.ru/search/vacancy"), false);
  assert.equal(isHhVacancyUrl("https://hh.ru/applicant/resumes"), false);
  assert.equal(isHhVacancyUrl("https://hh.ru/account/login"), false);
  assert.equal(isHhVacancyUrl("https://hh.ru/employer/123"), false);
  assert.equal(isHhVacancyUrl("https://hh.ru/"), false);
});

test("isHhVacancyUrl accepts real vacancy URLs", () => {
  assert.equal(isHhVacancyUrl("https://hh.ru/vacancy/12345678"), true);
  assert.equal(isHhVacancyUrl("https://spb.hh.ru/vacancy/12345678"), true);
  assert.equal(isHhVacancyUrl("https://hh.ru/applicant/vacancy_response?vacancyId=12345678"), true);
});

test("normalizeHhVacancyUrl returns canonical URL", () => {
  assert.equal(normalizeHhVacancyUrl("https://spb.hh.ru/vacancy/42?from=search"), "https://hh.ru/vacancy/42");
  assert.equal(normalizeHhVacancyUrl("https://hh.ru/search/vacancy/advanced"), null);
});
