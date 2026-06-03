import assert from "node:assert/strict";
import test from "node:test";

const { fastVacancyAnalysisSchema, normalizeFastAnalysis } = await import("../src/lib/vacancy-analysis-schemas.ts");

test("fastVacancyAnalysisSchema parses simplified payload", () => {
  const parsed = fastVacancyAnalysisSchema.parse({
    score: 74,
    should_apply: "maybe",
    confidence: "medium",
    summary: "Подходит частично",
    match_reasons: ["Опыт в праве"],
    red_flags: ["Нет опыта в банке"],
    missing_requirements: ["SQL"],
    next_action: "Уточнить требования"
  });
  assert.equal(parsed.score, 74);
  assert.equal(parsed.match_reasons.length, 1);
});

test("fastVacancyAnalysisSchema rejects more than 3 array items", () => {
  assert.throws(() =>
    fastVacancyAnalysisSchema.parse({
      score: 50,
      should_apply: "no",
      confidence: "low",
      summary: "",
      match_reasons: ["a", "b", "c", "d"],
      red_flags: [],
      missing_requirements: [],
      next_action: ""
    })
  );
});

test("normalizeFastAnalysis maps to full VacancyAnalysis shape", () => {
  const full = normalizeFastAnalysis({
    score: 80,
    should_apply: "yes",
    confidence: "high",
    summary: "Хорошо",
    match_reasons: ["React"],
    red_flags: [],
    missing_requirements: [],
    next_action: "Откликнуться"
  });
  assert.equal(full.vacancy_match_score, 80);
  assert.deepEqual(full.why_matches, ["React"]);
  assert.equal(full.suggested_next_action, "Откликнуться");
  assert.equal(full.cover_letter_brief.tone, "деловой, короткий, человеческий");
});
