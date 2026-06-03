import assert from "node:assert/strict";
import test from "node:test";

const {
  COVER_LETTER_SCORE_THRESHOLD,
  formatVacancyTitleForFollowUp,
  isEligibleForBulkCoverLetter,
  isEligibleForCoverLetter,
  isReadyToApplyQueueItem,
  statusAfterCoverLetterCreated
} = await import("../src/lib/vacancy-application-queue.ts");

function buildFollowUpText(vacancy) {
  const title = formatVacancyTitleForFollowUp(vacancy.title);
  if (vacancy.testStatus === "пройдено" || vacancy.testStatus === "отправлено") {
    return `Здравствуйте. Я прошёл тестирование по вакансии «${title}». Хотел уточнить, удалось ли его посмотреть и есть ли решение по дальнейшим этапам. Буду благодарен за обратную связь.`;
  }
  if (vacancy.status === "applied" || vacancy.status === "waiting_response" || vacancy.status === "no_response") {
    return `Здравствуйте. Недавно направлял отклик на вакансию «${title}». Хотел уточнить, актуальна ли ещё позиция и рассматривается ли моё резюме. Буду благодарен за обратную связь.`;
  }
  return `Здравствуйте. Хотел уточнить статус рассмотрения по вакансии «${title}». Буду благодарен за обратную связь.`;
}

test("ai_recommended without cover letter is not ready queue item", () => {
  assert.equal(isReadyToApplyQueueItem({ status: "ai_recommended", hasLetter: false }), false);
  assert.equal(isReadyToApplyQueueItem({ status: "ai_recommended", hasLetter: true }), true);
  assert.equal(isReadyToApplyQueueItem({ status: "ready_to_apply", hasLetter: true }), true);
});

test("status becomes ready_to_apply after cover letter when recommended", () => {
  const status = statusAfterCoverLetterCreated(
    { should_apply: "maybe", vacancy_match_score: 75 },
    "ai_recommended"
  );
  assert.equal(status, "ready_to_apply");
});

test("statusAfterCoverLetterCreated returns null when AI says no", () => {
  assert.equal(
    statusAfterCoverLetterCreated({ should_apply: "no", vacancy_match_score: 90 }, "ai_recommended"),
    null
  );
});

test("follow-up uses real vacancy title", () => {
  const text = buildFollowUpText({ title: "Юрист", status: "applied", testStatus: null });
  assert.match(text, /Юрист/);
  assert.doesNotMatch(text, /Фирст/);
});

test("follow-up title fallback for junk and long titles", () => {
  assert.match(formatVacancyTitleForFollowUp("Фирст"), /интересующую вакансию/);
  assert.match(formatVacancyTitleForFollowUp(""), /интересующую вакансию/);
  const long = "А".repeat(150);
  assert.equal(formatVacancyTitleForFollowUp(long).length, 118);
});

test("invalid_source is not eligible for cover letter", () => {
  assert.equal(
    isEligibleForCoverLetter({
      status: "invalid_source",
      matchScore: 90,
      aiAnalysisJson: "{}",
      hasLetter: false
    }),
    false
  );
});

test("bulk cover letter skips vacancies with letter and analysis errors", () => {
  assert.equal(
    isEligibleForBulkCoverLetter({
      status: "ai_recommended",
      matchScore: 80,
      aiAnalysisJson: "{}",
      hasLetter: true
    }),
    false
  );
  assert.equal(
    isEligibleForBulkCoverLetter({
      status: "analysis_error",
      matchScore: 80,
      aiAnalysisJson: "{}",
      hasLetter: false
    }),
    false
  );
});

test("bulk includes needs_review with score at threshold", () => {
  assert.equal(
    isEligibleForBulkCoverLetter({
      status: "needs_review",
      matchScore: COVER_LETTER_SCORE_THRESHOLD,
      aiAnalysisJson: "{}",
      hasLetter: false
    }),
    true
  );
});

test("follow-up after test uses test template", () => {
  const text = buildFollowUpText({ title: "Аналитик", status: "applied", testStatus: "пройдено" });
  assert.match(text, /тестирование/);
  assert.match(text, /Аналитик/);
});
