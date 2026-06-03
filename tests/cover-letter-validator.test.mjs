import assert from "node:assert/strict";
import test from "node:test";

/**
 * Unit tests for the cover letter sanitizer / validator.
 * Mirrors the logic in src/lib/cover-letter-validator.ts without importing it
 * (to keep tests free of TypeScript/ESM transform requirements).
 */

const MANAGERIAL_PATTERNS =
  /руковод|управлен|менеджер|директор|начальник|team\s*lead|тимлид|head\s+of|нач\.\s+отдел/i;
const CONTRACT_PATTERNS = /договор|контракт|согласован|оформлен|сделк/i;
const LITIGATION_PATTERNS = /суд|претензи|иск|арбитраж|спор|взыскан|досудеб/i;
const MANAGEMENT_IN_LETTER_PATTERNS =
  /руководил\s+отдел|управлял\s+отдел|руководил\s+команд|управлял\s+команд|руководил\s+юридическ|руководство\s+отдел|управление\s+отдел|руководство\s+команд|возглавлял\s+отдел|возглавлял\s+команд/i;

function isManagerial(ctx) {
  const text = [ctx.vacancyTitle, ...(ctx.vacancyKeyTasks ?? [])].join(" ");
  return MANAGERIAL_PATTERNS.test(text);
}
function isContractFocused(ctx) {
  const text = [ctx.vacancyTitle, ...(ctx.vacancyKeyTasks ?? []), ...(ctx.matchedRequirements ?? [])].join(" ");
  return CONTRACT_PATTERNS.test(text);
}
function isLitigationFocused(ctx) {
  const text = [ctx.vacancyTitle, ...(ctx.vacancyKeyTasks ?? []), ...(ctx.matchedRequirements ?? [])].join(" ");
  return LITIGATION_PATTERNS.test(text);
}

function validateCoverLetterText(text, ctx = {}) {
  const warnings = [];
  const lower = text.toLowerCase();

  if (/\bkpi\b/i.test(text) && !isManagerial(ctx)) {
    warnings.push({ code: "irrelevant_kpi", level: "critical" });
  }
  if (
    (lower.includes("сроки") || lower.includes("сократил")) &&
    (lower.includes("договор") || lower.includes("согласован")) &&
    !isContractFocused(ctx)
  ) {
    warnings.push({ code: "irrelevant_contract_speed", level: "critical" });
  }
  if (
    (lower.includes("досудеб") || lower.includes("претензи") || lower.includes("исков")) &&
    !isLitigationFocused(ctx)
  ) {
    warnings.push({ code: "irrelevant_litigation", level: "critical" });
  }
  if (MANAGEMENT_IN_LETTER_PATTERNS.test(text) && !isManagerial(ctx)) {
    warnings.push({ code: "irrelevant_management", level: "critical" });
  }
  if (
    (lower.includes("сейчас я руковожу") || lower.includes("сейчас руковожу")) &&
    !isManagerial(ctx)
  ) {
    warnings.push({ code: "irrelevant_current_leadership", level: "critical" });
  }
  if (/в компании|работая в|работал в|работаю в/i.test(text)) {
    warnings.push({ code: "employer_name_mention", level: "critical" });
  }
  if (/удалённ|удаленн|офисн|гибрид|командировк/i.test(text)) {
    warnings.push({ code: "work_format_promise", level: "warn" });
  }
  if (text.length > 1200) {
    warnings.push({ code: "too_long", level: "warn" });
  }
  if (
    ctx.salaryExpectationsRequested &&
    ctx.salaryPreferredText &&
    !lower.includes("зарплат") &&
    !lower.includes("ожидани") &&
    !lower.includes("тыс") &&
    !lower.includes("рублей")
  ) {
    warnings.push({ code: "missing_salary", level: "warn" });
  }
  return warnings;
}

function hasCriticalWarnings(warnings) {
  return warnings.some((w) => w.level === "critical");
}

// ---

test("warns on KPI in non-managerial vacancy — level is critical", () => {
  const text = "Рассматриваю вашу вакансию юриста. Внедрял KPI и процессные метрики.";
  const warnings = validateCoverLetterText(text, { vacancyTitle: "Юрист" });
  const kpiWarning = warnings.find((w) => w.code === "irrelevant_kpi");
  assert.ok(kpiWarning, "should warn about KPI");
  assert.equal(kpiWarning.level, "critical", "KPI warning should be critical");
});

test("no KPI warning for managerial vacancy", () => {
  const text = "Рассматриваю вашу вакансию. Внедрял KPI для команды.";
  const warnings = validateCoverLetterText(text, { vacancyTitle: "Руководитель юридического отдела" });
  assert.ok(!warnings.some((w) => w.code === "irrelevant_kpi"), "should not warn about KPI");
});

test("warns on contract speed in non-contract vacancy", () => {
  const text = "Сократил сроки согласования договоров с 5 до 2 дней.";
  const warnings = validateCoverLetterText(text, { vacancyTitle: "Юрист по корпоративному праву" });
  assert.ok(warnings.some((w) => w.code === "irrelevant_contract_speed"), "should warn about contract speed");
});

test("no contract speed warning for contract-focused vacancy", () => {
  const text = "Сократил сроки согласования договоров с 5 до 2 дней.";
  const warnings = validateCoverLetterText(text, {
    vacancyTitle: "Договорный юрист",
    matchedRequirements: ["согласование договоров"]
  });
  assert.ok(!warnings.some((w) => w.code === "irrelevant_contract_speed"), "should not warn for contract vacancy");
});

test("warns on employer name mention — level is critical", () => {
  const text = "Работал в компании Рога и Копыта три года.";
  const warnings = validateCoverLetterText(text);
  const w = warnings.find((w) => w.code === "employer_name_mention");
  assert.ok(w, "should warn about employer name");
  assert.equal(w.level, "critical", "employer mention should be critical");
});

test("warns on work format promise", () => {
  const text = "Готов работать удалённо или в офисе.";
  const warnings = validateCoverLetterText(text);
  assert.ok(warnings.some((w) => w.code === "work_format_promise"), "should warn about format promise");
});

test("warns on too long letter", () => {
  const text = "Текст. ".repeat(250); // well over 1200 chars
  const warnings = validateCoverLetterText(text);
  assert.ok(warnings.some((w) => w.code === "too_long"), "should warn about length");
});

test("no warnings for short clean letter", () => {
  const text =
    "Добрый день. Рассматриваю вашу вакансию юриста. " +
    "Имею опыт ведения правовой экспертизы документов и подготовки заключений. " +
    "Готов обсудить задачи, условия и формат работы.";
  const warnings = validateCoverLetterText(text, {
    vacancyTitle: "Юрист",
    vacancyKeyTasks: ["правовая экспертиза"],
    matchedRequirements: ["подготовка правовых заключений"]
  });
  assert.equal(warnings.length, 0, "clean letter should produce no warnings");
});

test("warns critical on 'сейчас я руковожу' for non-managerial vacancy", () => {
  const text = "Сейчас я руковожу юридическим отделом компании.";
  const warnings = validateCoverLetterText(text, { vacancyTitle: "Юрисконсульт" });
  const critical = warnings.filter((w) => w.level === "critical");
  assert.ok(critical.some((w) => w.code === "irrelevant_current_leadership"), "should be critical warning");
});

test("warns on missing salary when requested but not in text", () => {
  const text = "Добрый день. Рассматриваю вашу вакансию. Готов обсудить условия.";
  const warnings = validateCoverLetterText(text, {
    vacancyTitle: "Юрист",
    salaryExpectationsRequested: true,
    salaryPreferredText: "от 150 тыс. ₽"
  });
  assert.ok(warnings.some((w) => w.code === "missing_salary"), "should warn about missing salary phrase");
});

test("no missing salary warning when salary present in text", () => {
  const text = "Рассматриваю предложения от 150 тыс. ₽. Готов обсудить условия.";
  const warnings = validateCoverLetterText(text, {
    vacancyTitle: "Юрист",
    salaryExpectationsRequested: true,
    salaryPreferredText: "от 150 тыс. ₽"
  });
  assert.ok(!warnings.some((w) => w.code === "missing_salary"), "should not warn when salary present");
});

test("irrelevant_management fires critical when letter mentions руководил отделом for non-managerial vacancy", () => {
  const text = "Здравствуйте. Рассматриваю вашу вакансию юрисконсульта. Руководил отделом договорной работы три года.";
  const warnings = validateCoverLetterText(text, { vacancyTitle: "Юрисконсульт" });
  const w = warnings.find((w) => w.code === "irrelevant_management");
  assert.ok(w, "should warn about management mention");
  assert.equal(w.level, "critical", "management mention should be critical");
});

test("no irrelevant_management warning for managerial vacancy", () => {
  const text = "Здравствуйте. Рассматриваю вашу вакансию руководителя. Руководил командой юридического подразделения.";
  const warnings = validateCoverLetterText(text, { vacancyTitle: "Руководитель юридического отдела" });
  assert.ok(!warnings.some((w) => w.code === "irrelevant_management"), "should not warn for managerial vacancy");
});

test("irrelevant_litigation fires critical for non-litigation vacancy", () => {
  const text = "Здравствуйте. Рассматриваю вашу вакансию. Вёл досудебное урегулирование споров.";
  const warnings = validateCoverLetterText(text, { vacancyTitle: "Корпоративный юрист" });
  const w = warnings.find((w) => w.code === "irrelevant_litigation");
  assert.ok(w, "should warn about litigation");
  assert.equal(w.level, "critical", "litigation warning should be critical");
});

test("hasCriticalWarnings returns true when any critical warning present", () => {
  const warnings = [
    { code: "work_format_promise", level: "warn" },
    { code: "irrelevant_kpi", level: "critical" }
  ];
  assert.ok(hasCriticalWarnings(warnings), "should detect critical warning");
});

test("hasCriticalWarnings returns false when only warn-level warnings present", () => {
  const warnings = [
    { code: "work_format_promise", level: "warn" },
    { code: "too_long", level: "warn" }
  ];
  assert.ok(!hasCriticalWarnings(warnings), "should not flag as critical when no critical warnings");
});
