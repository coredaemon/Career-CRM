import assert from "node:assert/strict";
import test from "node:test";

const {
  isEligibleForCoverLetter,
  isReadyToApplyQueueItem,
  recommendedWithoutLetterWhere
} = await import("../src/lib/vacancy-application-queue.ts");

const { vacancyStatusLabel } = await import("../src/lib/vacancy-status.ts");

// ── Status labels ────────────────────────────────────────────────────────────

test("waiting_response label is «Ждём ответ»", () => {
  assert.equal(vacancyStatusLabel("waiting_response"), "Ждём ответ");
});

// ── Cover letter eligibility ─────────────────────────────────────────────────

test("applied is not eligible for cover letter", () => {
  assert.equal(
    isEligibleForCoverLetter({ status: "applied", matchScore: 90, aiAnalysisJson: "{}", hasLetter: false }),
    false
  );
});

test("waiting_response is not eligible for cover letter", () => {
  assert.equal(
    isEligibleForCoverLetter({ status: "waiting_response", matchScore: 90, aiAnalysisJson: "{}", hasLetter: false }),
    false
  );
});

test("no_response is not eligible for cover letter", () => {
  assert.equal(
    isEligibleForCoverLetter({ status: "no_response", matchScore: 90, aiAnalysisJson: "{}", hasLetter: false }),
    false
  );
});

test("rejected is not eligible for cover letter", () => {
  assert.equal(
    isEligibleForCoverLetter({ status: "rejected", matchScore: 90, aiAnalysisJson: "{}", hasLetter: false }),
    false
  );
});

test("skipped is not eligible for cover letter", () => {
  assert.equal(
    isEligibleForCoverLetter({ status: "skipped", matchScore: 90, aiAnalysisJson: "{}", hasLetter: false }),
    false
  );
});

test("invalid_source is not eligible for cover letter", () => {
  assert.equal(
    isEligibleForCoverLetter({ status: "invalid_source", matchScore: 90, aiAnalysisJson: "{}", hasLetter: false }),
    false
  );
});

test("ai_recommended with analysis and no letter is eligible for cover letter", () => {
  assert.equal(
    isEligibleForCoverLetter({ status: "ai_recommended", matchScore: 80, aiAnalysisJson: "{}", hasLetter: false }),
    true
  );
});

// ── Ready to apply queue ─────────────────────────────────────────────────────

test("ready_to_apply with letter is a ready queue item", () => {
  assert.equal(isReadyToApplyQueueItem({ status: "ready_to_apply", hasLetter: true }), true);
});

test("ai_recommended with letter is a ready queue item", () => {
  assert.equal(isReadyToApplyQueueItem({ status: "ai_recommended", hasLetter: true }), true);
});

test("ai_recommended without letter is NOT a ready queue item", () => {
  assert.equal(isReadyToApplyQueueItem({ status: "ai_recommended", hasLetter: false }), false);
});

test("applied is NOT a ready queue item even with letter", () => {
  assert.equal(isReadyToApplyQueueItem({ status: "applied", hasLetter: true }), false);
});

test("waiting_response is NOT a ready queue item even with letter", () => {
  assert.equal(isReadyToApplyQueueItem({ status: "waiting_response", hasLetter: true }), false);
});

// ── recommendedWithoutLetterWhere excludes post-apply statuses ────────────────

test("recommendedWithoutLetterWhere excludes waiting_response and no_response", () => {
  const where = recommendedWithoutLetterWhere();
  const excluded = where.status.notIn;
  assert.ok(excluded.includes("waiting_response"), "waiting_response must be excluded");
  assert.ok(excluded.includes("no_response"), "no_response must be excluded");
  assert.ok(excluded.includes("applied"), "applied must be excluded");
  assert.ok(excluded.includes("skipped"), "skipped must be excluded");
});
