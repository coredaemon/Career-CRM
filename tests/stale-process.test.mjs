import assert from "node:assert/strict";
import test from "node:test";

const { isStale, STALE_AFTER_MS } = await import("../src/lib/process-status.ts");

test("isStale returns false before timeout", () => {
  const updatedAt = new Date(Date.now() - STALE_AFTER_MS + 1000);
  assert.equal(isStale(updatedAt), false);
});

test("isStale returns true after 10 minutes", () => {
  const updatedAt = new Date(Date.now() - STALE_AFTER_MS - 1);
  assert.equal(isStale(updatedAt), true);
});
