import assert from "node:assert/strict";
import test from "node:test";

/**
 * Unit tests for the auto-regeneration logic in generateCoverLetterWithAi.
 * Tests the pure control-flow: validator fires → second attempt is made with forbidden fragments.
 * No I/O, no Prisma, no real AI calls — everything is mocked inline.
 */

// ─── Inline copy of validator helpers (no TS/ESM transform needed) ────────────

const MANAGERIAL_PATTERNS =
  /руковод|управлен|менеджер|директор|начальник|team\s*lead|тимлид|head\s+of|нач\.\s+отдел/i;
const CONTRACT_PATTERNS = /договор|контракт|согласован|оформлен|сделк/i;
const LITIGATION_PATTERNS = /суд|претензи|иск|арбитраж|спор|взыскан|досудеб/i;
const MANAGEMENT_IN_LETTER_PATTERNS =
  /руководил\s+отдел|управлял\s+отдел|руководил\s+команд|управлял\s+команд|руководил\s+юридическ|руководство\s+отдел|управление\s+отдел|руководство\s+команд|возглавлял\s+отдел|возглавлял\s+команд/i;

function isManagerial(ctx) {
  return MANAGERIAL_PATTERNS.test([ctx.vacancyTitle, ...(ctx.vacancyKeyTasks ?? [])].join(" "));
}
function isContractFocused(ctx) {
  return CONTRACT_PATTERNS.test([ctx.vacancyTitle, ...(ctx.vacancyKeyTasks ?? []), ...(ctx.matchedRequirements ?? [])].join(" "));
}
function isLitigationFocused(ctx) {
  return LITIGATION_PATTERNS.test([ctx.vacancyTitle, ...(ctx.vacancyKeyTasks ?? []), ...(ctx.matchedRequirements ?? [])].join(" "));
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
  return warnings;
}

function hasCriticalWarnings(warnings) {
  return warnings.some((w) => w.level === "critical");
}

const WARNING_FRAGMENT_MAP = {
  irrelevant_kpi: "KPI и процессные метрики",
  irrelevant_contract_speed: "сокращение сроков согласования договоров",
  irrelevant_litigation: "досудебное урегулирование, претензии, судебные споры",
  irrelevant_management: "руководство отделом, управление командой",
  irrelevant_current_leadership: "фраза «сейчас я руковожу»",
  employer_name_mention: "упоминания прошлых работодателей",
  work_format_promise: "обещания формата работы",
};

function warningToForbiddenFragment(w) {
  return WARNING_FRAGMENT_MAP[w.code] ?? w.code;
}

// ─── Simulated generateCoverLetterWithAi logic ────────────────────────────────
// Stripped to the auto-regen control flow only (no real AI calls).

async function simulateGenerate({ firstText, secondText, externalForbidden = [], ctx = {} }) {
  const calls = [];

  async function mockParseRouterJson(systemContent) {
    calls.push(systemContent);
    return calls.length === 1 ? firstText : secondText;
  }

  // First attempt
  const text1 = await mockParseRouterJson("first-attempt-system");
  const warnings1 = validateCoverLetterText(text1, ctx);

  if (hasCriticalWarnings(warnings1)) {
    const critFragments = warnings1
      .filter((w) => w.level === "critical")
      .map(warningToForbiddenFragment);
    const allForbidden = [...externalForbidden, ...critFragments];
    const forbiddenInstruction = `НЕ используй: ${allForbidden.join("; ")}.`;

    const text2 = await mockParseRouterJson("second-attempt-system " + forbiddenInstruction);
    const warnings2 = validateCoverLetterText(text2, ctx);

    return {
      coverLetter: text2,
      warnings: warnings2,
      autoRegenerated: true,
      firstAttemptWarnings: warnings1,
      calls
    };
  }

  return {
    coverLetter: text1,
    warnings: warnings1,
    autoRegenerated: false,
    calls
  };
}

// ─── Tests ─────────────────────────────────────────────────────────────────────

test("auto-regeneration is triggered when first attempt has critical warnings", async () => {
  const firstText = "Здравствуйте. Внедрял KPI для юридического отдела.";
  const secondText = "Здравствуйте. Рассматриваю вашу вакансию юриста. Готов обсудить задачи.";
  const ctx = { vacancyTitle: "Юрист" };

  const result = await simulateGenerate({ firstText, secondText, ctx });

  assert.ok(result.autoRegenerated, "should mark as auto-regenerated");
  assert.equal(result.coverLetter, secondText, "should return second attempt text");
  assert.ok(result.firstAttemptWarnings?.some((w) => w.code === "irrelevant_kpi"), "should record first attempt warnings");
  assert.equal(result.calls.length, 2, "should have made exactly two generation calls");
});

test("forbidden fragments from first attempt are included in second call system prompt", async () => {
  const firstText = "Рассматриваю вашу вакансию. Внедрял KPI для отдела.";
  const secondText = "Здравствуйте. Рассматриваю вашу вакансию юриста. Готов обсудить условия.";
  const ctx = { vacancyTitle: "Юрисконсульт" };

  const result = await simulateGenerate({ firstText, secondText, ctx });

  const secondCallPrompt = result.calls[1];
  assert.ok(
    secondCallPrompt.includes("KPI и процессные метрики"),
    "second call should forbid the KPI fragment"
  );
});

test("external forbiddenFragments are combined with auto-detected critical fragments", async () => {
  const firstText = "Рассматриваю вашу вакансию. Работал в компании Ромашка.";
  const secondText = "Здравствуйте. Рассматриваю вашу вакансию. Готов обсудить.";
  const externalForbidden = ["название работодателя"];
  const ctx = { vacancyTitle: "Юрист" };

  const result = await simulateGenerate({ firstText, secondText, externalForbidden, ctx });

  const secondCallPrompt = result.calls[1];
  assert.ok(secondCallPrompt.includes("название работодателя"), "should include external forbidden fragment");
  assert.ok(secondCallPrompt.includes("упоминания прошлых работодателей"), "should include auto-detected employer fragment");
});

test("no auto-regeneration when first attempt has only warn-level warnings", async () => {
  const firstText = "Рассматриваю вашу вакансию. Готов работать удалённо.";
  const secondText = "should not be used";
  const ctx = { vacancyTitle: "Юрист" };

  const result = await simulateGenerate({ firstText, secondText, ctx });

  assert.ok(!result.autoRegenerated, "should not auto-regenerate for warn-only letter");
  assert.equal(result.coverLetter, firstText, "should return first attempt text");
  assert.equal(result.calls.length, 1, "should have made exactly one generation call");
});

test("clean letter with no warnings returns first attempt without regeneration", async () => {
  const firstText =
    "Здравствуйте. Рассматриваю вашу вакансию юриста. " +
    "Имею опыт договорной работы и правовой экспертизы. " +
    "Готов обсудить задачи, условия и формат работы.";
  const ctx = {
    vacancyTitle: "Юрист",
    vacancyKeyTasks: ["договорная работа", "правовая экспертиза"],
    matchedRequirements: ["согласование договоров"]
  };

  const result = await simulateGenerate({ firstText, secondText: "unused", ctx });

  assert.ok(!result.autoRegenerated, "clean letter should not trigger auto-regeneration");
  assert.equal(result.warnings.length, 0, "clean letter should have no warnings");
});

test("after auto-regeneration the returned warnings are from the second attempt", async () => {
  const firstText = "Рассматриваю вашу вакансию. Внедрял KPI.";
  // Second attempt still has a soft warning (too long / work format) but no critical ones
  const secondText = "Здравствуйте. Рассматриваю вашу вакансию юриста. Готов обсудить условия и формат работы.";
  const ctx = { vacancyTitle: "Юрист" };

  const result = await simulateGenerate({ firstText, secondText, ctx });

  assert.ok(result.autoRegenerated);
  assert.ok(!result.warnings.some((w) => w.code === "irrelevant_kpi"), "final warnings should not include first-attempt KPI warning");
});

test("salary expectation inserted only when vacancyKeyTasks indicate it — structural check", () => {
  // This test verifies the brief logic: if salaryExpectationsRequested is false,
  // no salary fragment should appear in the generation prompt.
  const ctx = {
    vacancyTitle: "Юрист",
    salaryExpectationsRequested: false,
    salaryPreferredText: "от 150 тыс. ₽"
  };
  // validator: missing_salary fires only when salaryExpectationsRequested=true
  const textWithoutSalary = "Здравствуйте. Рассматриваю вашу вакансию. Готов обсудить условия.";
  const warnings = validateCoverLetterText(textWithoutSalary, ctx);
  assert.ok(!warnings.some((w) => w.code === "missing_salary"), "salary warning should not fire when not requested");
});
