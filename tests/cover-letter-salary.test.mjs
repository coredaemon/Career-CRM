import assert from "node:assert/strict";
import test from "node:test";

/**
 * Tests that cover letter prompt construction correctly handles salary expectations.
 * These are unit tests of the prompt logic, not integration tests calling real AI.
 */

function buildSalaryInstruction({ salaryRequested, salaryText, overrideSalaryText }) {
  const effectiveRequested =
    overrideSalaryText !== undefined ? overrideSalaryText !== null : salaryRequested;
  const effectiveText =
    overrideSalaryText !== undefined ? overrideSalaryText : salaryText;

  if (!effectiveRequested) return "";

  if (effectiveText) {
    return `Работодатель просит указать зарплатные ожидания. Добавь в конец письма фразу: «${effectiveText}»`;
  }
  return "Работодатель просит указать зарплатные ожидания. Добавь фразу: «Готов обсудить задачи, условия и зарплатные ожидания.» — не придумывай сумму.";
}

test("salary instruction included when requested and text provided", () => {
  const instruction = buildSalaryInstruction({
    salaryRequested: true,
    salaryText: "от 150 тыс. ₽",
    overrideSalaryText: undefined
  });
  assert.match(instruction, /от 150 тыс/);
  assert.doesNotMatch(instruction, /не придумывай сумму/);
});

test("salary instruction uses generic phrase when no text and requested", () => {
  const instruction = buildSalaryInstruction({
    salaryRequested: true,
    salaryText: null,
    overrideSalaryText: undefined
  });
  assert.match(instruction, /Готов обсудить задачи, условия и зарплатные ожидания/);
  assert.match(instruction, /не придумывай сумму/);
  assert.doesNotMatch(instruction, /\d+\s*тыс/);
});

test("no salary instruction when not requested", () => {
  const instruction = buildSalaryInstruction({
    salaryRequested: false,
    salaryText: "от 150 тыс. ₽",
    overrideSalaryText: undefined
  });
  assert.equal(instruction, "");
});

test("override null means do not include salary", () => {
  const instruction = buildSalaryInstruction({
    salaryRequested: true,
    salaryText: "от 150 тыс. ₽",
    overrideSalaryText: null
  });
  assert.equal(instruction, "");
});

test("override text replaces saved text", () => {
  const instruction = buildSalaryInstruction({
    salaryRequested: false,
    salaryText: "от 150 тыс. ₽",
    overrideSalaryText: "от 200 тыс. ₽ net"
  });
  assert.match(instruction, /200 тыс/);
  assert.doesNotMatch(instruction, /150 тыс/);
});

test("salary instruction not present when salary not requested and no override", () => {
  const instruction = buildSalaryInstruction({
    salaryRequested: false,
    salaryText: null,
    overrideSalaryText: undefined
  });
  assert.equal(instruction, "");
});
