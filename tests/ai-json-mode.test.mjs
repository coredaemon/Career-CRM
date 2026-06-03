import assert from "node:assert/strict";
import test from "node:test";

const { supportsJsonMode, isResponseFormatError } = await import("../src/lib/ai-json-mode.ts");

test("supportsJsonMode for known providers", () => {
  assert.equal(supportsJsonMode("openai"), true);
  assert.equal(supportsJsonMode("deepseek"), true);
  assert.equal(supportsJsonMode("compatible"), true);
  assert.equal(supportsJsonMode("unknown"), false);
});

test("isResponseFormatError detects response_format errors", () => {
  assert.equal(isResponseFormatError(400, "Invalid response_format"), true);
  assert.equal(isResponseFormatError(500, "server error"), false);
});
