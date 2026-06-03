import assert from "node:assert/strict";
import test from "node:test";

const { AI_TIMEOUT_MS_FAST, AI_TIMEOUT_MS_FULL, AI_REPAIR_TIMEOUT_MS } = await import("../src/lib/process-status.ts");

test("fast mode uses shorter timeout than full", () => {
  assert.equal(AI_TIMEOUT_MS_FAST, 60_000);
  assert.equal(AI_TIMEOUT_MS_FULL, 90_000);
  assert.ok(AI_REPAIR_TIMEOUT_MS <= 45_000);
  assert.ok(AI_TIMEOUT_MS_FAST < AI_TIMEOUT_MS_FULL);
});
