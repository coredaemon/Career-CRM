import assert from "node:assert/strict";
import test from "node:test";

const { searchRunItemStatusLabel, isSearchRunItemJunk } = await import("../src/lib/search-run-stats-core.ts");

test("searchRunItemStatusLabel covers planned statuses", () => {
  const expected = {
    created: "Новая вакансия",
    duplicate: "Дубль",
    skipped_not_vacancy: "Служебная ссылка",
    skipped_invalid_description: "Плохое описание",
    analyzed: "AI-анализ выполнен",
    analysis_error: "Ошибка AI",
    invalid_source: "Невалидный источник",
    error: "Ошибка"
  };
  for (const [status, label] of Object.entries(expected)) {
    assert.equal(searchRunItemStatusLabel(status), label);
  }
});

test("isSearchRunItemJunk flags service links", () => {
  assert.equal(isSearchRunItemJunk("skipped_not_vacancy", false), true);
  assert.equal(isSearchRunItemJunk("created", true), false);
});
