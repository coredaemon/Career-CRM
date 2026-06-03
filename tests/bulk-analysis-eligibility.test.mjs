import assert from "node:assert/strict";
import test from "node:test";

const { vacancyEligibleForBulkWhere } = await import("../src/lib/process-status.ts");

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
