import Link from "next/link";
import { notFound } from "next/navigation";
import { CopyButton } from "@/components/copy-button";
import { CreateCoverLetterButton } from "@/components/create-cover-letter-button";
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
import { buildFollowUpText } from "@/lib/follow-up";
import { isEligibleForCoverLetter } from "@/lib/vacancy-application-queue";
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
  const resumeId = latestLetter?.resumeId || vacancy.searchProfile?.resumeId;
  const showCreateLetter = isEligibleForCoverLetter({
    status: vacancy.status,
    matchScore: vacancy.matchScore,
    aiAnalysisJson: vacancy.aiAnalysisJson,
    hasLetter: Boolean(latestLetter),
    isInvalid: isInvalidSource
  });
  const followUpText = buildFollowUpText(vacancy);
  const aiMeta = fromJsonText<{
    analysis?: { provider?: string; model?: string };
    writer?: { provider?: string; model?: string };
    reviewer?: { provider?: string; model?: string } | null;
    analysisFallbackUsed?: boolean;
    fallbackProvider?: string;
    fallbackModel?: string;
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
            {aiMeta.analysisFallbackUsed ? (
              <p className="mt-1 text-xs text-[var(--muted)]">
                Анализ выполнен резервной моделью: {aiMeta.fallbackProvider === "openai" ? "OpenAI" : aiMeta.fallbackProvider}
                {aiMeta.fallbackModel ? ` (${aiMeta.fallbackModel})` : ""}
              </p>
            ) : null}
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
                <div className="mt-4">
                  <CoverLetterTools vacancyId={vacancy.id} resumeId={latestLetter.resumeId} currentText={latestLetter.text} />
                </div>
              </>
            ) : showCreateLetter ? (
              <div className="mt-4">
                <p className="text-sm text-[var(--muted)]">Создайте письмо на основе AI-разбора, резюме и подтверждённых фактов.</p>
                <div className="mt-4">
                  <CreateCoverLetterButton vacancyId={vacancy.id} resumeId={resumeId} />
                </div>
              </div>
            ) : (
              <p className="mt-3 text-sm text-[var(--muted)]">Письмо ещё не создано. Сначала выполните AI-анализ вакансии.</p>
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
            <VacancyQuickActions
              vacancyId={vacancy.id}
              status={vacancy.status}
              sourceUrl={vacancy.sourceUrl}
              hasCoverLetter={Boolean(latestLetter)}
              hasAiAnalysis={Boolean(vacancy.aiAnalysisJson)}
              matchScore={vacancy.matchScore}
              coverLetterText={latestLetter?.text}
              resumeId={resumeId}
              hideApply={isInvalidSource}
            />
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
    status_changed: "Статус изменён",
    application_sent_manually: "Отклик отправлен вручную"
  };
  return labels[type] ?? type;
}
