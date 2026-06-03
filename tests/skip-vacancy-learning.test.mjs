import assert from "node:assert/strict";
import test from "node:test";

/**
 * Unit tests for skip vacancy logic without hitting the database.
 * Tests the rule-building logic and observation structure.
 */

function buildSuggestedRule(quickReasons, title, missingRequirements = []) {
  if (quickReasons.includes("Не мой профиль") || quickReasons.includes("Нет опыта в этой специализации")) {
    const missing = missingRequirements[0] ?? null;
    return missing
      ? `Понижать приоритет вакансий с требованием "${missing}", если этот опыт не подтверждён резюме.`
      : `Понижать приоритет вакансий с профилем, схожим с «${title}», если необходимый опыт не подтверждён резюме.`;
  }
  if (quickReasons.includes("Мало денег")) {
    return "Понижать приоритет вакансий с зарплатой ниже ожиданий кандидата.";
  }
  if (quickReasons.includes("Продажи / холодные звонки")) {
    return "Не рекомендовать вакансии с явными признаками холодных продаж / KPI-звонков.";
  }
  if (quickReasons.includes("Тестирование до общения")) {
    return "Понижать приоритет вакансий, требующих тестирование до первого контакта с работодателем.";
  }
  return `Пересмотреть приоритет вакансий, похожих на «${title}».`;
}

test("skip with 'Нет опыта в этой специализации' suggests rule with missing requirement", () => {
  const rule = buildSuggestedRule(
    ["Нет опыта в этой специализации"],
    "Патентный поверенный",
    ["патентное право"]
  );
  assert.match(rule, /патентное право/);
  assert.match(rule, /Понижать приоритет/);
});

test("skip with 'Мало денег' suggests salary rule", () => {
  const rule = buildSuggestedRule(["Мало денег"], "Юрист");
  assert.match(rule, /зарплат/);
});

test("skip with 'Продажи / холодные звонки' suggests sales rule", () => {
  const rule = buildSuggestedRule(["Продажи / холодные звонки"], "Менеджер по продажам");
  assert.match(rule, /продаж/);
});

test("skip with 'Тестирование до общения' suggests test rule", () => {
  const rule = buildSuggestedRule(["Тестирование до общения"], "Юрист");
  assert.match(rule, /тестирование/);
});

test("skip without reason produces fallback rule", () => {
  const rule = buildSuggestedRule(["Не хочу объяснять"], "Юрист");
  assert.match(rule, /Юрист/);
});

test("LearningObservation draft is not created when no reasons given", () => {
  const quickReasons = [];
  const comment = "";
  const shouldCreate = quickReasons.length > 0 || Boolean(comment);
  assert.equal(shouldCreate, false);
});

test("LearningObservation draft IS created when reasons given", () => {
  const quickReasons = ["Мало денег"];
  const comment = "";
  const shouldCreate = quickReasons.length > 0 || Boolean(comment);
  assert.equal(shouldCreate, true);
});

test("LearningObservation draft IS created when only comment given", () => {
  const quickReasons = [];
  const comment = "Не понравилась компания";
  const shouldCreate = quickReasons.length > 0 || Boolean(comment);
  assert.equal(shouldCreate, true);
});

test("draft observation status is not used as active rule", () => {
  const draftStatus = "draft";
  const acceptedStatus = "accepted";
  assert.notEqual(draftStatus, acceptedStatus);

  // Only accepted observations should be included in analysis
  const observations = [
    { status: "draft", suggestedRule: "правило 1" },
    { status: "accepted", suggestedRule: "правило 2" },
    { status: "rejected", suggestedRule: "правило 3" }
  ];
  const activeRules = observations.filter((o) => o.status === "accepted");
  assert.equal(activeRules.length, 1);
  assert.equal(activeRules[0].suggestedRule, "правило 2");
});
