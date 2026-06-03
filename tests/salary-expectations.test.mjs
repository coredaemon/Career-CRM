import assert from "node:assert/strict";
import test from "node:test";

const { fastVacancyAnalysisSchema } = await import("../src/lib/vacancy-analysis-schemas.ts");
const { statusFromAiAnalysis } = await import("../src/lib/vacancy-status.ts");

test("fastVacancyAnalysisSchema accepts salary_expectations_requested", () => {
  const result = fastVacancyAnalysisSchema.parse({
    score: 70,
    should_apply: "yes",
    confidence: "high",
    summary: "test",
    match_reasons: [],
    red_flags: [],
    missing_requirements: [],
    next_action: "",
    salary_expectations_requested: true
  });
  assert.equal(result.salary_expectations_requested, true);
});

test("fastVacancyAnalysisSchema defaults salary_expectations_requested to false", () => {
  const result = fastVacancyAnalysisSchema.parse({
    score: 70,
    should_apply: "yes",
    confidence: "medium",
    summary: "",
    match_reasons: [],
    red_flags: [],
    missing_requirements: [],
    next_action: ""
  });
  assert.equal(result.salary_expectations_requested, false);
});

test("fastVacancyAnalysisSchema parses resume_match_basis", () => {
  const result = fastVacancyAnalysisSchema.parse({
    score: 50,
    should_apply: "maybe",
    confidence: "low",
    summary: "",
    match_reasons: [],
    red_flags: [],
    missing_requirements: [],
    next_action: "",
    resume_match_basis: {
      matched_requirements: ["гражданское право"],
      unsupported_requirements: ["патентное право"],
      specialized_requirements_not_in_resume: ["патентный поверенный"],
      recommendation_reason: "Ключевая специализация не подтверждена"
    }
  });
  assert.deepEqual(result.resume_match_basis.matched_requirements, ["гражданское право"]);
  assert.deepEqual(result.resume_match_basis.specialized_requirements_not_in_resume, ["патентный поверенный"]);
});

test("statusFromAiAnalysis: maybe + score < 50 → rejected_by_ai", () => {
  assert.equal(
    statusFromAiAnalysis({ shouldApply: "maybe", score: 40 }),
    "rejected_by_ai"
  );
});

test("statusFromAiAnalysis: maybe + score 50-74 → needs_review", () => {
  assert.equal(
    statusFromAiAnalysis({ shouldApply: "maybe", score: 60 }),
    "needs_review"
  );
});

test("statusFromAiAnalysis: maybe + score ≥ 75 → ai_recommended", () => {
  assert.equal(
    statusFromAiAnalysis({ shouldApply: "maybe", score: 80 }),
    "ai_recommended"
  );
});

test("statusFromAiAnalysis: no → rejected_by_ai regardless of score", () => {
  assert.equal(
    statusFromAiAnalysis({ shouldApply: "no", score: 90 }),
    "rejected_by_ai"
  );
});

test("statusFromAiAnalysis: yes → ready_to_apply", () => {
  assert.equal(
    statusFromAiAnalysis({ shouldApply: "yes", score: 30 }),
    "ready_to_apply"
  );
});
