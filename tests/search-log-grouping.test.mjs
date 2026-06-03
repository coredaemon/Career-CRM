import assert from "node:assert/strict";
import test from "node:test";

const { groupSkippedLogMessages } = await import("../src/lib/search-log-grouping.ts");

test("groupSkippedLogMessages summarizes NOT_HH_VACANCY_URL", () => {
  const items = [
    { errorCode: "NOT_HH_VACANCY_URL", errorMessage: "a", sourceUrl: "https://hh.ru/search/vacancy/map" },
    { errorCode: "NOT_HH_VACANCY_URL", errorMessage: "b", sourceUrl: "https://hh.ru/search/vacancy/map?x=1" },
    { errorCode: "NOT_HH_VACANCY_URL", errorMessage: "c", sourceUrl: "https://hh.ru/employer/1" }
  ];
  const { summaryLines } = groupSkippedLogMessages(items);
  assert.equal(summaryLines.length, 1);
  assert.match(summaryLines[0], /Пропущены служебные ссылки hh: 3/);
});
