import Link from "next/link";
import { notFound } from "next/navigation";
import { CopyButton } from "@/components/copy-button";
import { CoverLetterTools } from "@/components/cover-letter-tools";
import { InvalidVacancyPanel } from "@/components/invalid-vacancy-panel";
import { VacancyAiErrorPanel } from "@/components/vacancy-ai-error-panel";
import { VacancyAiRetryButton } from "@/components/vacancy-ai-retry-button";
import { VacancyQuickActions } from "@/components/vacancy-quick-actions";
import { VacancyStatusSelect } from "@/components/vacancy-status-select";
import { Card, PageHeader } from "@/components/ui";
import { fromJsonText } from "@/lib/json";
import { prisma } from "@/lib/prisma";
import { validateVacancyDraft } from "@/lib/vacancy-validation";
import { vacancyStatusLabel } from "@/lib/vacancy-status";

export const dynamic = "force-dynamic";

type VacancyAnalysisView = {
  summary?: string;
  confidence?: string;
  why_matches?: string[];
  weak_matches?: string[];
  red_flags?: string[];
  missing_requirements?: string[];
  recommended_resume_angle?: string;
  recommended_cover_letter_focus?: string[];
  reasoning_short?: string;
  suggested_next_action?: string;
};

export default async function VacancyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const vacancy = await prisma.vacancy.findUnique({
    where: { id },
    include: {
      company: true,
      searchProfile: true,
      coverLetters: {
        orderBy: { createdAt: "desc" },
        include: { resume: true }
      },
      interactions: {
        orderBy: { occurredAt: "desc" }
      }
    }
  });

  if (!vacancy) notFound();

  const descriptionValidation = validateVacancyDraft({
    title: vacancy.title,
    companyName: vacancy.company?.name,
    source: vacancy.source,
    sourceUrl: vacancy.sourceUrl,
    sourceVacancyId: vacancy.sourceVacancyId,
    rawDescription: vacancy.rawDescription
  });
  const looksLikeServicePage = !descriptionValidation.ok && descriptionValidation.code === "COOKIE_OR_NAVIGATION_PAGE";
  const isInvalidSource = vacancy.status === "invalid_source" || vacancy.status === "skipped_invalid";

  const analysis = fromJsonText<VacancyAnalysisView>(vacancy.aiAnalysisJson, {});
  const latestLetter = vacancy.coverLetters[0];
  const followUpText = buildFollowUpText(vacancy);
  const aiMeta = fromJsonText<{
    analysis?: { provider?: string; model?: string };
    writer?: { provider?: string; model?: string };
    reviewer?: { provider?: string; model?: string } | null;
  }>(vacancy.aiMetaJson, {});

  return (
    <>
      <PageHeader
        title={vacancy.title}
        description={`${vacancy.company?.name || "Компания не указана"} · ${vacancyStatusLabel(vacancy.status)}`}
        action={<TopActions sourceUrl={vacancy.sourceUrl} />}
      />
      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className="grid gap-6">
          {isInvalidSource ? (
            <InvalidVacancyPanel
              vacancyId={vacancy.id}
              sourceUrl={vacancy.sourceUrl}
              reason={vacancy.analysisErrorMessage || vacancy.recommendation}
            />
          ) : null}
          {vacancy.status === "analysis_error" ? (
            <VacancyAiErrorPanel
              vacancyId={vacancy.id}
              errorCode={vacancy.analysisErrorCode}
              errorMessage={vacancy.analysisErrorMessage || vacancy.recommendation}
              technicalDetails={vacancy.analysisErrorCode === "INVALID_AI_JSON" ? vacancy.recommendation || undefined : undefined}
              looksLikeServicePage={looksLikeServicePage}
            />
          ) : null}
          <Card>
            <h2 className="text-xl font-semibold tracking-normal">Обзор</h2>
            <div className="mt-4 grid gap-3 text-sm text-[var(--muted)] sm:grid-cols-2">
              <div>Компания: {vacancy.company?.name || "не указана"}</div>
              <div>Зарплата: {vacancy.salaryText || "не указана"}</div>
              <div>Город / регион: {vacancy.location || "не указан"}</div>
              <div>Формат работы: {vacancy.workFormat || "не указан"}</div>
              <div>Источник: {sourceLabel(vacancy.source)}</div>
              <div>Профиль поиска: {vacancy.searchProfile?.title || "не выбран"}</div>
            </div>
            {vacancy.sourceUrl ? (
              <p className="mt-4 break-words text-sm">
                <a href={vacancy.sourceUrl} target="_blank" rel="noreferrer" className="text-[var(--accent)] hover:underline">
                  {vacancy.sourceUrl}
                </a>
              </p>
            ) : null}
            {looksLikeServicePage && !isInvalidSource ? (
              <p className="mt-4 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
                Описание похоже на служебный текст страницы, а не на текст вакансии.
              </p>
            ) : null}
            <pre id="vacancy-description" className="mt-5 whitespace-pre-wrap rounded-md border border-[var(--line)] bg-[var(--soft)] p-4 text-sm leading-6">
              {vacancy.rawDescription || "Описание не сохранено."}
            </pre>
          </Card>

          <Card>
            <h2 className="text-xl font-semibold tracking-normal">AI-разбор</h2>
            <div className="mt-4 text-4xl font-semibold tracking-normal">{vacancy.matchScore ?? "—"}</div>
            <p className="mt-2 text-sm text-[var(--muted)]">
              Уверенность: {confidenceLabel(analysis.confidence)} · Аналитик: {aiMeta.analysis?.model || "не указан"} · Писатель:{" "}
              {aiMeta.writer?.model || "не указан"}
              {aiMeta.reviewer ? ` · Проверяющий: ${aiMeta.reviewer.model}` : ""}
            </p>
            <p className="mt-3 text-sm leading-6 text-[var(--muted)]">{analysis.summary || "AI-анализ ещё не выполнялся."}</p>
            <List title="Почему подходит" items={analysis.why_matches} />
            <List title="Слабые совпадения" items={analysis.weak_matches} />
            <List title="Красные флаги" items={analysis.red_flags} />
            <List title="Неподтверждённые требования" items={analysis.missing_requirements} />
            <TextBlock title="Ракурс резюме" text={analysis.recommended_resume_angle} />
            <List title="Фокус сопроводительного письма" items={analysis.recommended_cover_letter_focus} />
            <TextBlock title="Короткое объяснение" text={analysis.reasoning_short} />
            <TextBlock title="Следующее действие от AI" text={analysis.suggested_next_action} />
            <TextBlock title="Рекомендация" text={vacancy.recommendation} />
          </Card>

          <Card>
            <h2 className="text-xl font-semibold tracking-normal">Сопроводительное письмо</h2>
            {latestLetter ? (
              <>
                <p className="mt-1 text-sm text-[var(--muted)]">Версия: {latestLetter.style} · резюме: {latestLetter.resume.title}</p>
                <pre className="mt-4 whitespace-pre-wrap rounded-md border border-[var(--line)] bg-[var(--soft)] p-4 text-sm leading-6">{latestLetter.text}</pre>
                <div className="mt-4 flex flex-wrap gap-3">
                  <CopyButton text={latestLetter.text} />
                </div>
                <div className="mt-5">
                  <CoverLetterTools vacancyId={vacancy.id} resumeId={latestLetter.resumeId} />
                </div>
              </>
            ) : (
              <p className="mt-3 text-sm text-[var(--muted)]">Письмо ещё не создано. Оно появится после AI-анализа или перегенерации.</p>
            )}
          </Card>

          <Card>
            <h2 className="text-xl font-semibold tracking-normal">Тестирование</h2>
            <div className="mt-4 grid gap-3 text-sm text-[var(--muted)] sm:grid-cols-2">
              <div>Требуется: {vacancy.testRequired ? "да" : "нет"}</div>
              <div>Статус: {vacancy.testStatus || "не требуется"}</div>
              <div>Ссылка: {vacancy.testLink || "не указана"}</div>
              <div>Завершено: {vacancy.testCompletedAt ? vacancy.testCompletedAt.toLocaleDateString("ru-RU") : "не отмечено"}</div>
            </div>
            {vacancy.testNotes ? <p className="mt-4 text-sm leading-6 text-[var(--muted)]">{vacancy.testNotes}</p> : null}
          </Card>

          <Card>
            <h2 className="text-xl font-semibold tracking-normal">Follow-up</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">Шаблон для ручной отправки. CareerOS ничего не отправляет автоматически.</p>
            <pre className="mt-4 whitespace-pre-wrap rounded-md border border-[var(--line)] bg-[var(--soft)] p-4 text-sm leading-6">{followUpText}</pre>
            <div className="mt-4">
              <CopyButton text={followUpText} label="Скопировать follow-up" />
            </div>
          </Card>

          <Card>
            <h2 className="text-xl font-semibold tracking-normal">Компания</h2>
            <p className="mt-3 text-sm text-[var(--muted)]">{vacancy.company?.name || "Компания не указана."}</p>
            {vacancy.company?.website ? <p className="mt-2 text-sm">{vacancy.company.website}</p> : null}
            {vacancy.company?.notes ? <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{vacancy.company.notes}</p> : null}
          </Card>

          <Card>
            <h2 className="text-xl font-semibold tracking-normal">История / заметки</h2>
            <div className="mt-4 grid gap-3">
              {vacancy.interactions.length === 0 ? (
                <p className="text-sm text-[var(--muted)]">Событий пока нет.</p>
              ) : (
                vacancy.interactions.map((interaction) => (
                  <div key={interaction.id} className="rounded-md border border-[var(--line)] p-3">
                    <div className="text-sm font-semibold">{interactionTypeLabel(interaction.type)}</div>
                    <div className="mt-1 text-xs text-[var(--muted)]">{interaction.occurredAt.toLocaleString("ru-RU")}</div>
                    <p className="mt-2 text-sm text-[var(--muted)]">{interaction.summary}</p>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>
        <aside className="grid content-start gap-4">
          <Card>
            <h2 className="mb-3 text-lg font-semibold tracking-normal">Статус</h2>
            <VacancyStatusSelect vacancyId={vacancy.id} currentStatus={vacancy.status} />
          </Card>
          <Card>
            <h2 className="mb-3 text-lg font-semibold tracking-normal">Быстрые действия</h2>
            <VacancyQuickActions vacancyId={vacancy.id} sourceUrl={vacancy.sourceUrl} hideApply={isInvalidSource} />
          </Card>
          <Card>
            <h2 className="mb-3 text-lg font-semibold tracking-normal">AI-анализ</h2>
            <VacancyAiRetryButton vacancyId={vacancy.id} />
          </Card>
          <Card>
            <h2 className="text-lg font-semibold tracking-normal">Совпадение</h2>
            <div className="mt-3 text-5xl font-semibold tracking-normal">{vacancy.finalScore ?? vacancy.matchScore ?? "—"}</div>
          </Card>
          <Card>
            <h2 className="text-lg font-semibold tracking-normal">Следующее действие</h2>
            <p className="mt-3 text-sm text-[var(--muted)]">{vacancy.nextActionType || "не задано"}</p>
            {vacancy.nextActionAt ? <p className="mt-2 text-sm text-[var(--muted)]">{vacancy.nextActionAt.toLocaleString("ru-RU")}</p> : null}
            {vacancy.nextActionNote ? <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{vacancy.nextActionNote}</p> : null}
          </Card>
        </aside>
      </div>
    </>
  );
}

function TopActions({ sourceUrl }: { sourceUrl?: string | null }) {
  return (
    <div className="flex flex-wrap gap-2">
      <Link href="/vacancies/new" className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white dark:text-black">
        Добавить вакансию
      </Link>
      {sourceUrl ? <CopyButton text={sourceUrl} label="Скопировать ссылку" /> : null}
    </div>
  );
}

function List({ title, items }: { title: string; items?: string[] }) {
  if (!items?.length) return null;
  return (
    <div className="mt-5">
      <h3 className="text-sm font-semibold">{title}</h3>
      <ul className="mt-2 grid gap-2 text-sm leading-6 text-[var(--muted)]">
        {items.map((item) => (
          <li key={item}>• {item}</li>
        ))}
      </ul>
    </div>
  );
}

function TextBlock({ title, text }: { title: string; text?: string | null }) {
  if (!text) return null;
  return (
    <div className="mt-5">
      <h3 className="text-sm font-semibold">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{text}</p>
    </div>
  );
}

function sourceLabel(source: string) {
  if (source === "manual") return "ручной ввод";
  if (source === "other") return "другой источник";
  return source;
}

function confidenceLabel(confidence?: string) {
  if (confidence === "low") return "низкая";
  if (confidence === "high") return "высокая";
  return "средняя";
}

function interactionTypeLabel(type: string) {
  const labels: Record<string, string> = {
    vacancy_created: "Вакансия создана",
    vacancy_analyzed: "Вакансия проанализирована",
    cover_letter_created: "Сопроводительное письмо создано",
    status_changed: "Статус изменён"
  };
  return labels[type] ?? type;
}

function buildFollowUpText(vacancy: {
  title: string;
  status: string;
  testStatus: string | null;
}) {
  if (vacancy.testStatus === "пройдено" || vacancy.testStatus === "отправлено") {
    return `Здравствуйте. Я прошёл тестирование по вакансии «${vacancy.title}». Хотел уточнить, удалось ли его посмотреть и есть ли решение по дальнейшим этапам. Буду благодарен за обратную связь.`;
  }

  if (vacancy.status === "waiting_response" || vacancy.status === "no_response") {
    return `Здравствуйте. Недавно направлял отклик на вакансию «${vacancy.title}». Хотел уточнить, актуальна ли ещё позиция и рассматривается ли моё резюме. Буду благодарен за обратную связь.`;
  }

  return `Здравствуйте. Хотел уточнить статус рассмотрения по вакансии «${vacancy.title}». Буду благодарен за обратную связь.`;
}
