import assert from "node:assert/strict";
import test from "node:test";

const { AiAnalysisError } = await import("../src/lib/ai-errors.ts");

test("AiAnalysisError exposes INVALID_AI_JSON code and diagnostics", () => {
  const error = new AiAnalysisError({
    code: "INVALID_AI_JSON",
    userMessage: "AI не смог разобрать вакансию в структурированном формате.",
    diagnostics: { attempts: 2, repairUsed: true, fallbackUsed: false, totalDurationMs: 120000 }
  });
  assert.equal(error.code, "INVALID_AI_JSON");
  assert.match(error.userMessage, /структурированном/);
  assert.equal(error.diagnostics?.attempts, 2);
  assert.equal(error.diagnostics?.repairUsed, true);
});
