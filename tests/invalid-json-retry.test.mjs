import assert from "node:assert/strict";
import test from "node:test";

const { AiAnalysisError } = await import("../src/lib/ai-errors.ts");

test("AiAnalysisError exposes INVALID_AI_JSON code", () => {
  const error = new AiAnalysisError({
    code: "INVALID_AI_JSON",
    userMessage: "Модель аналитика ответила не в том формате."
  });
  assert.equal(error.code, "INVALID_AI_JSON");
  assert.match(error.userMessage, /формате/);
});
