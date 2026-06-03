import assert from "node:assert/strict";
import test from "node:test";

const {
  buildProcessRunUiState,
  computeProgressDisplay,
  computeEta,
  effectiveProcessStatus,
  processStatusLabel
} = await import("../src/lib/process-status.ts");

const {
  parseAnalysisMode,
  analysisModeIncludesWriter,
  analysisModeIncludesReviewer,
  analysisModeIncludesAnalysis
} = await import("../src/lib/analysis-mode.ts");

test("effectiveProcessStatus shows stopping when stop requested", () => {
  const now = new Date();
  assert.equal(effectiveProcessStatus("running", now, true), "stopping");
});

test("computeProgressDisplay uses 1-based display when processed > 0", () => {
  const { displayCurrent, progressPercent } = computeProgressDisplay(3, 17);
  assert.equal(displayCurrent, 3);
  assert.equal(progressPercent, 18);
});

test("computeEta returns estimate after 2 items", () => {
  const started = new Date(Date.now() - 120_000);
  const eta = computeEta(2, 10, started);
  assert.ok(eta.avgSecondsPerItem);
  assert.ok(eta.etaSeconds);
});

test("buildProcessRunUiState humanSummary for running bulk", () => {
  const state = buildProcessRunUiState({
    id: "p1",
    type: "vacancy_analysis",
    status: "running",
    title: "Массовый AI-анализ",
    progressCurrent: 2,
    progressTotal: 17,
    startedAt: new Date(),
    updatedAt: new Date(),
    analysisMode: "fast"
  });
  assert.match(state.humanSummary, /2 из 17/);
  assert.equal(state.canStop, true);
});

test("analysis mode flags", () => {
  assert.equal(analysisModeIncludesAnalysis(parseAnalysisMode("fast")), true);
  assert.equal(analysisModeIncludesWriter(parseAnalysisMode("fast")), false);
  assert.equal(analysisModeIncludesReviewer(parseAnalysisMode("fast")), false);
  assert.equal(analysisModeIncludesWriter(parseAnalysisMode("full")), true);
});

test("processStatusLabel includes stopping", () => {
  assert.equal(processStatusLabel("running", new Date(), true), "Останавливается…");
});

test("AI_TIMEOUT error code exists in ai-errors flow", async () => {
  const { AiAnalysisError } = await import("../src/lib/ai-errors.ts");
  const err = new AiAnalysisError({ code: "AI_TIMEOUT", userMessage: "timeout" });
  assert.equal(err.code, "AI_TIMEOUT");
});
