import assert from "node:assert/strict";
import test from "node:test";

const { analysisModeIncludesWriter } = await import("../src/lib/analysis-mode.ts");

function shouldWriteCoverLetterForStatus(status) {
  return status === "ai_recommended" || status === "ready_to_apply";
}

test("fast mode does not include writer", () => {
  assert.equal(analysisModeIncludesWriter("fast"), false);
});

test("cover letters only for recommended statuses", () => {
  assert.equal(shouldWriteCoverLetterForStatus("ai_recommended"), true);
  assert.equal(shouldWriteCoverLetterForStatus("ready_to_apply"), true);
  assert.equal(shouldWriteCoverLetterForStatus("found"), false);
  assert.equal(shouldWriteCoverLetterForStatus("rejected_by_ai"), false);
});

test("full mode includes writer capability but letters gated by status", () => {
  assert.equal(analysisModeIncludesWriter("full"), true);
  const status = "found";
  const shouldWrite = analysisModeIncludesWriter("full") && shouldWriteCoverLetterForStatus(status);
  assert.equal(shouldWrite, false);
});
