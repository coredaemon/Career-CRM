import assert from "node:assert/strict";
import test from "node:test";

const { prepareVacancyTextForAi } = await import("../src/lib/prepare-vacancy-text.ts");

test("prepareVacancyTextForAi removes cookie noise", () => {
  const longBody = "Обязанности: вести договоры. ".repeat(20);
  const result = prepareVacancyTextForAi({
    rawDescription: `Мы используем cookie. Принять все. ${longBody}`
  });
  assert.equal(result.ok, true);
  assert.ok(!result.text.toLowerCase().includes("cookie"));
  assert.ok(result.text.includes("Обязанности"));
});

test("prepareVacancyTextForAi rejects too short text", () => {
  const result = prepareVacancyTextForAi({ rawDescription: "короткий текст" });
  assert.equal(result.ok, false);
});

test("prepareVacancyTextForAi truncates long descriptions", () => {
  const result = prepareVacancyTextForAi({ rawDescription: "a".repeat(9000) });
  assert.equal(result.ok, true);
  assert.equal(result.text.length, 7000);
});
