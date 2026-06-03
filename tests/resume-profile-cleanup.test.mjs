import assert from "node:assert/strict";
import test from "node:test";

const {
  isVisibleInSearch,
  pickFallbackActiveProfile,
  resumeTextChangePatch,
  shouldArchiveResumeOnDelete,
  sortActiveFirst
} = await import("../src/lib/resume-profile-rules.ts");

const {
  FULL_VACANCY_RESET_CONFIRM_TEXT,
  isProtectedVacancyForCleanup,
  requiresFullResetConfirmation,
  shouldDeleteDraftObservation,
  shouldPreserveAcceptedObservation
} = await import("../src/lib/data-cleanup-rules.ts");

test("editing resume text marks AI analysis stale", () => {
  assert.deepEqual(resumeTextChangePatch("old resume", "new resume"), { changed: true, aiSummaryStale: true });
  assert.deepEqual(resumeTextChangePatch("same", "same"), { changed: false, aiSummaryStale: false });
});

test("archived resumes and profiles are hidden from search choices", () => {
  assert.equal(isVisibleInSearch({ id: "resume-1", isArchived: true }), false);
  assert.equal(isVisibleInSearch({ id: "profile-1", status: "archived" }), false);
  assert.equal(isVisibleInSearch({ id: "profile-2", status: "active", isArchived: false }), true);
});

test("active resume and active profile sort first", () => {
  const sorted = sortActiveFirst([
    { id: "old", isActive: false, updatedAt: "2026-01-01" },
    { id: "active", isActive: true, updatedAt: "2025-01-01" },
    { id: "newer", isActive: false, updatedAt: "2026-02-01" }
  ]);
  assert.equal(sorted[0].id, "active");
  assert.equal(sorted[1].id, "newer");
});

test("deleting used resume should archive it instead of physical delete", () => {
  assert.equal(shouldArchiveResumeOnDelete({ searchProfiles: 1, applications: 0, coverLetters: 0 }), true);
  assert.equal(shouldArchiveResumeOnDelete({ searchProfiles: 0, applications: 0, coverLetters: 0 }), false);
});

test("active profile deletion falls back to another visible profile", () => {
  const fallback = pickFallbackActiveProfile(
    [
      { id: "deleted", isActive: true, status: "active", updatedAt: "2026-01-01" },
      { id: "archived", status: "archived", updatedAt: "2026-03-01" },
      { id: "candidate", status: "draft", updatedAt: "2026-02-01" }
    ],
    "deleted"
  );
  assert.equal(fallback?.id, "candidate");
});

test("cleanup untouched vacancies does not touch applications or cover letters", () => {
  assert.equal(isProtectedVacancyForCleanup({ status: "applied", applications: [], coverLetters: [] }), true);
  assert.equal(isProtectedVacancyForCleanup({ status: "found", applications: [{}], coverLetters: [] }), true);
  assert.equal(isProtectedVacancyForCleanup({ status: "found", applications: [], coverLetters: [{}] }), true);
  assert.equal(isProtectedVacancyForCleanup({ status: "found", applications: [], coverLetters: [], interactions: [] }), false);
});

test("full vacancy reset requires strong confirmation text", () => {
  assert.equal(requiresFullResetConfirmation("full_vacancy_reset", ""), true);
  assert.equal(requiresFullResetConfirmation("full_vacancy_reset", FULL_VACANCY_RESET_CONFIRM_TEXT), false);
  assert.equal(requiresFullResetConfirmation("untouched_vacancies", ""), false);
});

test("accepted observations survive cleanup and draft observations require opt-in", () => {
  assert.equal(shouldPreserveAcceptedObservation("accepted"), true);
  assert.equal(shouldDeleteDraftObservation("draft", false), false);
  assert.equal(shouldDeleteDraftObservation("draft", true), true);
});

