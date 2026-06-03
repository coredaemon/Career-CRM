import assert from "node:assert/strict";
import test from "node:test";

const { vacancyEligibleForBulkWhere } = await import("../src/lib/process-status.ts");
const { isHhVacancyUrl } = await import("../src/lib/hh-url.ts");

const BULK_EXCLUDED_STATUSES = ["invalid_source", "skipped_invalid", "archived", "applied"];

test("vacancyEligibleForBulkWhere excludes invalid_source", () => {
  const where = vacancyEligibleForBulkWhere();
  assert.ok(where.status);
  assert.ok("notIn" in where.status);
  for (const status of BULK_EXCLUDED_STATUSES) {
    assert.ok(where.status.notIn.includes(status), `${status} must be excluded`);
  }
});

test("vacancyEligibleForBulkWhere requires search profile", () => {
  const where = vacancyEligibleForBulkWhere();
  assert.deepEqual(where.searchProfileId, { not: null });
});

test("hh map URL is excluded from vacancy collection", () => {
  assert.equal(isHhVacancyUrl("https://hh.ru/search/vacancy/map"), false);
});
