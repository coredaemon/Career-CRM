import assert from "node:assert/strict";
import test from "node:test";

/**
 * Unit tests for the cover letter brief relevance filter.
 * Tests the logic that selects only facts relevant to the vacancy from
 * the full candidate_strengths list.
 *
 * The updated filter checks both matchedRequirements AND jobPriorities
 * (formerly only matchedRequirements).
 */

function isStrengthRelevant(strength, referenceTexts) {
  const strengthWords = strength.toLowerCase().split(/\s+/).filter((w) => w.length > 4);
  return referenceTexts.some((ref) => {
    const refWords = ref.toLowerCase().split(/\s+/).filter((w) => w.length > 4);
    return strengthWords.some((sw) =>
      refWords.some((rw) => rw.startsWith(sw.slice(0, 5)) || sw.startsWith(rw.slice(0, 5)))
    );
  });
}

function filterRelevantFacts(allStrengths, matchedRequirements, jobPriorities = []) {
  const referenceTexts = [...matchedRequirements, ...jobPriorities];
  return allStrengths.filter((strength) => isStrengthRelevant(strength, referenceTexts));
}

function getExcludedFacts(allStrengths, relevantFacts) {
  return allStrengths.filter((s) => !relevantFacts.includes(s));
}

test("brief excludes KPI fact when vacancy is not managerial", () => {
  const allStrengths = [
    "Внедрил KPI для юридического отдела",
    "Успешно вёл договорную работу"
  ];
  const matchedRequirements = [
    "опыт договорной работы и согласования контрактов"
  ];

  const relevant = filterRelevantFacts(allStrengths, matchedRequirements);
  const excluded = getExcludedFacts(allStrengths, relevant);

  assert.ok(!relevant.includes("Внедрил KPI для юридического отдела"), "KPI fact should be excluded");
  assert.ok(excluded.includes("Внедрил KPI для юридического отдела"), "KPI fact should appear in excluded");
  assert.ok(relevant.some((f) => f.includes("договорн")), "contract fact should be included");
});

test("brief excludes contract speed fact for non-contract vacancy", () => {
  const allStrengths = [
    "Сократил сроки согласования договоров с 5 до 2 дней",
    "Успешно представлял интересы в судебных заседаниях"
  ];
  const matchedRequirements = [
    "опыт судебного представительства",
    "ведение исков и претензионная работа"
  ];

  const relevant = filterRelevantFacts(allStrengths, matchedRequirements);
  const excluded = getExcludedFacts(allStrengths, relevant);

  assert.ok(excluded.some((f) => f.includes("сроки")), "contract speed fact should be excluded");
  assert.ok(relevant.some((f) => f.includes("судебн")), "litigation fact should be included");
});

test("brief includes 60% pretrial fact only for litigation vacancy", () => {
  const pretrial = "Урегулировал 60% дел в досудебном порядке";

  const litigationRequirements = [
    "претензионная и судебная работа",
    "урегулирование досудебных споров"
  ];
  const nonLitigationRequirements = [
    "ведение договорной работы",
    "согласование контрактов"
  ];

  const relevantForLitigation = filterRelevantFacts([pretrial], litigationRequirements);
  const relevantForNonLitigation = filterRelevantFacts([pretrial], nonLitigationRequirements);

  assert.ok(
    relevantForLitigation.includes(pretrial),
    "pretrial fact should be included for litigation vacancy"
  );
  assert.ok(
    !relevantForNonLitigation.includes(pretrial),
    "pretrial fact should be excluded for non-litigation vacancy"
  );
});

test("excluded facts list is complement of relevant facts", () => {
  const allStrengths = ["Факт A", "Факт B", "Факт C"];
  const relevant = ["Факт A"];
  const excluded = getExcludedFacts(allStrengths, relevant);

  assert.deepEqual(excluded.sort(), ["Факт B", "Факт C"].sort());
  assert.equal(relevant.length + excluded.length, allStrengths.length);
});

test("empty matched requirements excludes all candidate strengths", () => {
  const allStrengths = ["Сильный факт 1", "Сильный факт 2"];
  const relevant = filterRelevantFacts(allStrengths, []);
  const excluded = getExcludedFacts(allStrengths, relevant);

  assert.equal(relevant.length, 0);
  assert.equal(excluded.length, 2);
});

test("relevant fact passes when multiple requirements overlap", () => {
  const allStrengths = ["Руководил командой юридического подразделения"];
  const matchedRequirements = [
    "управление юридической функцией",
    "опыт руководства командой"
  ];

  const relevant = filterRelevantFacts(allStrengths, matchedRequirements);
  assert.ok(relevant.length > 0, "overlapping requirement should include the fact");
});

test("filter includes fact matched via jobPriorities even if not in matchedRequirements", () => {
  const allStrengths = [
    "Подготовка правовых заключений и правовая экспертиза",
    "Внедрил KPI для отдела"
  ];
  const matchedRequirements = [];
  const jobPriorities = [
    "правовые заключения по запросам бизнеса",
    "экспертиза договоров"
  ];

  const relevant = filterRelevantFacts(allStrengths, matchedRequirements, jobPriorities);
  const excluded = getExcludedFacts(allStrengths, relevant);

  assert.ok(
    relevant.some((f) => f.includes("заключений")),
    "fact matched via jobPriorities should be included"
  );
  assert.ok(
    excluded.some((f) => f.includes("KPI")),
    "unrelated KPI fact should remain excluded"
  );
});

test("empty matchedRequirements but non-empty jobPriorities selects relevant facts", () => {
  const allStrengths = ["Сопровождение корпоративных процессов", "Ведение претензионной работы"];
  const matchedRequirements = [];
  const jobPriorities = ["корпоративное сопровождение и регистрационные процедуры"];

  const relevant = filterRelevantFacts(allStrengths, matchedRequirements, jobPriorities);

  assert.ok(relevant.some((f) => f.includes("корпоративных")), "corporate fact should match jobPriorities");
  assert.equal(relevant.filter((f) => f.includes("претензи")).length, 0, "litigation fact should not match");
});

test("empty matchedRequirements AND empty jobPriorities still excludes all facts", () => {
  const allStrengths = ["Факт A", "Факт B"];
  const relevant = filterRelevantFacts(allStrengths, [], []);

  assert.equal(relevant.length, 0, "no references means nothing is relevant");
});
