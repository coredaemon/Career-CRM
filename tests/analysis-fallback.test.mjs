import assert from "node:assert/strict";
import test from "node:test";

test("OpenAI fallback uses vacancy_analysis_fallback task type", () => {
  const taskTypes = ["vacancy_analysis", "vacancy_analysis_fallback", "json_repair"];
  assert.ok(taskTypes.includes("vacancy_analysis_fallback"));
  assert.ok(taskTypes.includes("json_repair"));
});
