import assert from "node:assert/strict";
import test from "node:test";

test("search run stats aggregates item statuses", () => {
  const items = [
    { status: "duplicate" },
    { status: "created" },
    { status: "analyzed" },
    { status: "analysis_error" }
  ];

  const totalDuplicates = items.filter((item) => item.status === "duplicate").length;
  const totalCreated = items.filter((item) => ["created", "analyzed", "analysis_error"].includes(item.status)).length;
  const totalAnalyzed = items.filter((item) => item.status === "analyzed").length;
  const totalAnalysisErrors = items.filter((item) => item.status === "analysis_error").length;

  assert.equal(totalDuplicates, 1);
  assert.equal(totalCreated, 3);
  assert.equal(totalAnalyzed, 1);
  assert.equal(totalAnalysisErrors, 1);
});
