import assert from "node:assert/strict";
import test from "node:test";

const { aggregateSearchRunItems, computeSearchRunDisplayStats, searchRunItemStatusLabel } = await import(
  "../src/lib/search-run-stats-core.ts"
);

test("aggregateSearchRunItems counts from item statuses", () => {
  const items = [
    { status: "duplicate", vacancyId: "v1", vacancy: { status: "found", coverLetters: [] } },
    { status: "created", vacancyId: "v2", vacancy: { status: "found", coverLetters: [] } },
    { status: "analyzed", vacancyId: "v3", vacancy: { status: "ai_recommended", coverLetters: [{ id: "c1" }] } },
    { status: "analysis_error", vacancyId: "v4", vacancy: { status: "analysis_error", coverLetters: [] } },
    { status: "skipped_not_vacancy", vacancyId: null, vacancy: null }
  ];

  const stats = aggregateSearchRunItems(items, { foundLinks: 10 }, 0);
  assert.equal(stats.totalDuplicates, 1);
  assert.equal(stats.totalCreated, 1);
  assert.equal(stats.totalAnalyzed, 1);
  assert.equal(stats.totalAnalysisErrors, 1);
  assert.equal(stats.skippedNotVacancy, 1);
  assert.equal(stats.sentToAi, 2);
  assert.equal(stats.totalFound, 10);
  assert.equal(stats.validVacancies, 3);
});

test("totalFound uses items.length when only skipped items exist", () => {
  const items = [
    { status: "skipped_not_vacancy", vacancyId: null, vacancy: null },
    { status: "skipped_not_vacancy", vacancyId: null, vacancy: null }
  ];
  const stats = aggregateSearchRunItems(items, {}, 0);
  assert.equal(stats.totalFound, 2);
  assert.equal(stats.totalCreated, 0);
});

test("computeSearchRunDisplayStats detects stored mismatch", () => {
  const items = [{ status: "created", vacancyId: "v1", vacancy: { status: "found", coverLetters: [] } }];
  const result = computeSearchRunDisplayStats(items, {}, {
    totalFound: 0,
    totalCreated: 0,
    totalDuplicates: 0,
    totalAnalyzed: 0,
    totalErrors: 0,
    totalRecommended: 0,
    totalAnalysisErrors: 0,
    totalCoverLetters: 0
  });
  assert.equal(result.useDerived, true);
  assert.equal(result.metrics.totalFound, 1);
  assert.equal(result.metrics.totalCreated, 1);
});

test("searchRunItemStatusLabel returns Russian labels", () => {
  assert.equal(searchRunItemStatusLabel("created"), "Новая вакансия");
  assert.equal(searchRunItemStatusLabel("skipped_not_vacancy"), "Служебная ссылка");
  assert.equal(searchRunItemStatusLabel("analysis_error"), "Ошибка AI");
});
