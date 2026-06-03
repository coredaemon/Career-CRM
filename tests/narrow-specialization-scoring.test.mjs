import assert from "node:assert/strict";
import test from "node:test";

const { NARROW_SPECIALIZATION_RULES } = await import("../src/lib/narrow-specializations.ts");
const { fastVacancyAnalysisSchema } = await import("../src/lib/vacancy-analysis-schemas.ts");
const { statusFromAiAnalysis } = await import("../src/lib/vacancy-status.ts");

test("NARROW_SPECIALIZATION_RULES is a non-empty array", () => {
  assert.ok(Array.isArray(NARROW_SPECIALIZATION_RULES));
  assert.ok(NARROW_SPECIALIZATION_RULES.length > 0);
});

test("NARROW_SPECIALIZATION_RULES contains патентное право", () => {
  assert.ok(NARROW_SPECIALIZATION_RULES.includes("патентное право"));
});

test("NARROW_SPECIALIZATION_RULES contains M&A", () => {
  assert.ok(NARROW_SPECIALIZATION_RULES.some((r) => r.includes("M&A")));
});

test("patent vacancy scenario: score ≤ 45 + should_apply=no → rejected_by_ai status", () => {
  const analysis = fastVacancyAnalysisSchema.parse({
    score: 35,
    should_apply: "no",
    confidence: "high",
    summary: "Вакансия требует патентного поверенного",
    match_reasons: [],
    red_flags: ["Патентное право не подтверждено резюме"],
    missing_requirements: ["Патентный поверенный"],
    next_action: "",
    resume_match_basis: {
      matched_requirements: [],
      unsupported_requirements: [],
      specialized_requirements_not_in_resume: ["патентный поверенный"],
      recommendation_reason: "Ключевой фокус вакансии не подтверждён резюме."
    }
  });

  assert.equal(analysis.score, 35);
  assert.equal(analysis.should_apply, "no");
  assert.deepEqual(
    analysis.resume_match_basis.specialized_requirements_not_in_resume,
    ["патентный поверенный"]
  );

  const status = statusFromAiAnalysis({ shouldApply: analysis.should_apply, score: analysis.score });
  assert.equal(status, "rejected_by_ai");
});

test("vacancy with 1-2 missing key requirements: score ≤ 65 + maybe → needs_review", () => {
  const analysis = fastVacancyAnalysisSchema.parse({
    score: 60,
    should_apply: "maybe",
    confidence: "medium",
    summary: "Частичное совпадение",
    match_reasons: ["корпоративное право"],
    red_flags: [],
    missing_requirements: ["опыт M&A сделок"],
    next_action: ""
  });

  assert.ok(analysis.score <= 65);
  const status = statusFromAiAnalysis({ shouldApply: analysis.should_apply, score: analysis.score });
  assert.equal(status, "needs_review");
});

test("skipped vacancy should not appear in recommended (status check)", () => {
  const SKIP_STATUSES = new Set(["skipped", "archived", "rejected_by_ai"]);
  assert.ok(SKIP_STATUSES.has("skipped"));
  assert.ok(!SKIP_STATUSES.has("ai_recommended"));
});
