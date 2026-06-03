import assert from "node:assert/strict";
import test from "node:test";

const { searchRunStatusLabel, processStatusLabel, effectiveSearchRunStatus } = await import("../src/lib/process-status.ts");

test("Russian labels for process statuses", () => {
  assert.equal(processStatusLabel("running"), "Выполняется");
  assert.equal(processStatusLabel("stale"), "Завис");
  assert.equal(processStatusLabel("running", new Date(), true), "Останавливается…");
  assert.equal(searchRunStatusLabel("completed"), "Завершён");
});

test("effectiveSearchRunStatus marks old running as stale", () => {
  const old = new Date(Date.now() - 11 * 60 * 1000);
  assert.equal(effectiveSearchRunStatus("running", old), "stale");
});
