import assert from "node:assert/strict";
import test from "node:test";

const { extractJsonFromAiResponse } = await import("../src/lib/extract-json.ts");
const { FAST_ANALYSIS_SCHEMA_DESCRIPTION } = await import("../src/lib/vacancy-analysis-schemas.ts");

test("extractJsonFromAiResponse used for repair candidate", () => {
  const raw = '```json\n{"score": 70, "should_apply": "maybe", "confidence": "medium", "summary": "ok", "match_reasons": [], "red_flags": [], "missing_requirements": [], "next_action": "review"}\n```';
  const json = extractJsonFromAiResponse(raw);
  assert.ok(json);
  assert.match(FAST_ANALYSIS_SCHEMA_DESCRIPTION, /score/);
});
