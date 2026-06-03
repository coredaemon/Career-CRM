import assert from "node:assert/strict";
import test from "node:test";

const { extractJsonFromAiResponse } = await import("../src/lib/extract-json.ts");

test("extractJsonFromAiResponse parses fenced json block", () => {
  const input = 'Вот ответ:\n```json\n{"score": 80, "should_apply": "yes"}\n```';
  const result = extractJsonFromAiResponse(input);
  assert.equal(result, '{"score": 80, "should_apply": "yes"}');
});

test("extractJsonFromAiResponse finds first json object in text", () => {
  const input = 'Ответ модели: {"ok": true} спасибо';
  const result = extractJsonFromAiResponse(input);
  assert.equal(result, '{"ok": true}');
});

test("extractJsonFromAiResponse returns null for invalid payload", () => {
  assert.equal(extractJsonFromAiResponse("not json at all"), null);
});
