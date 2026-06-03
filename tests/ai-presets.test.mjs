import assert from "node:assert/strict";
import test from "node:test";

const { chooseModelForRole, providerPreset } = await import("../src/lib/ai-presets.ts");

test("AI roles choose DeepSeek for analysis and fast fallbacks", () => {
  assert.equal(providerPreset("deepseek").defaults.analysis, "deepseek-v4-flash");
  assert.equal(chooseModelForRole("deepseek", "analysis", []), "deepseek-v4-flash");
  assert.equal(chooseModelForRole("deepseek", "fast", ["deepseek-chat"]), "deepseek-chat");
});

test("AI roles choose OpenAI writer and reviewer fallbacks", () => {
  assert.equal(providerPreset("openai").defaults.writer, "gpt-5.4-mini");
  assert.equal(chooseModelForRole("openai", "writer", []), "gpt-5.4-mini");
  assert.equal(chooseModelForRole("openai", "reviewer", ["gpt-4o-mini"]), "gpt-4o-mini");
});
