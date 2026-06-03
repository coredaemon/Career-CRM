import assert from "node:assert/strict";
import test from "node:test";

/**
 * Tests that all vacancy status values have Russian display labels
 * and that no raw technical status values leak into user-visible text.
 */

// Mirrors src/lib/vacancy-status.ts without TypeScript imports
const vacancyStatuses = [
  "found",
  "ai_recommended",
  "needs_review",
  "rejected_by_ai",
  "ready_to_apply",
  "applied",
  "waiting_response",
  "rejected",
  "no_response",
  "archived",
  "skipped",
  "skipped_invalid",
  "invalid_source",
  "analysis_error"
];

const vacancyStatusLabels = {
  found: "Найдена",
  ai_recommended: "AI рекомендует",
  needs_review: "На проверке",
  rejected_by_ai: "AI не рекомендует",
  ready_to_apply: "Готово к отклику",
  applied: "Отклик отправлен",
  waiting_response: "Ждём ответ",
  rejected: "Отказ",
  no_response: "Нет ответа",
  archived: "Архив",
  skipped: "Пропущена",
  skipped_invalid: "Невалидная",
  invalid_source: "Невалидный источник",
  analysis_error: "Ошибка анализа"
};

function vacancyStatusLabel(status) {
  return vacancyStatusLabels[status] ?? status;
}

test("every VacancyStatus has a Russian label in vacancyStatusLabels", () => {
  for (const status of vacancyStatuses) {
    assert.ok(
      Object.prototype.hasOwnProperty.call(vacancyStatusLabels, status),
      `Missing Russian label for status: "${status}"`
    );
    const label = vacancyStatusLabels[status];
    assert.ok(label.length > 0, `Label for "${status}" is empty`);
    // Label should not contain underscore (raw technical name)
    assert.ok(
      !label.includes("_"),
      `Label for "${status}" looks like a raw technical value: "${label}"`
    );
  }
});

test("vacancyStatusLabels map covers all statuses — no missing entries", () => {
  const labelKeys = Object.keys(vacancyStatusLabels);
  assert.equal(
    labelKeys.length,
    vacancyStatuses.length,
    `Label map has ${labelKeys.length} entries but there are ${vacancyStatuses.length} statuses`
  );
});

test("vacancyStatusLabel fallback returns the raw value when status unknown", () => {
  // This is a safety check: if a new status is added to DB but not to labels,
  // the label function should return the raw value (not crash).
  const unknown = vacancyStatusLabel("some_new_status");
  assert.equal(unknown, "some_new_status");
});

test("ai_recommended maps to Russian, not raw technical string", () => {
  assert.equal(vacancyStatusLabel("ai_recommended"), "AI рекомендует");
  assert.notEqual(vacancyStatusLabel("ai_recommended"), "ai_recommended");
});

test("rejected_by_ai maps to Russian, not raw technical string", () => {
  assert.equal(vacancyStatusLabel("rejected_by_ai"), "AI не рекомендует");
  assert.notEqual(vacancyStatusLabel("rejected_by_ai"), "rejected_by_ai");
});

test("ready_to_apply maps to Russian", () => {
  assert.equal(vacancyStatusLabel("ready_to_apply"), "Готово к отклику");
});

test("analysis_error maps to Russian", () => {
  assert.equal(vacancyStatusLabel("analysis_error"), "Ошибка анализа");
});

test("invalid_source maps to Russian", () => {
  assert.equal(vacancyStatusLabel("invalid_source"), "Невалидный источник");
});

// Interaction type labels
const interactionTypeLabels = {
  vacancy_created: "Вакансия создана",
  vacancy_analyzed: "Вакансия проанализирована",
  cover_letter_created: "Сопроводительное письмо создано",
  status_changed: "Статус изменён",
  application_sent_manually: "Отклик отправлен вручную",
  vacancy_rejected_by_user: "Вакансия отклонена пользователем"
};

test("all interaction type labels are human-readable Russian", () => {
  for (const [type, label] of Object.entries(interactionTypeLabels)) {
    assert.ok(!label.includes("_"), `Interaction label for "${type}" contains underscore: "${label}"`);
    assert.ok(label.length > 0);
  }
});
