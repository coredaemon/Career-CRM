import Link from "next/link";
import { notFound } from "next/navigation";
import { CopyButton } from "@/components/copy-button";
import { CoverLetterTools } from "@/components/cover-letter-tools";
import { VacancyStatusSelect } from "@/components/vacancy-status-select";
import { Card, PageHeader } from "@/components/ui";
import { fromJsonText } from "@/lib/json";
import { prisma } from "@/lib/prisma";
import { vacancyStatusLabel } from "@/lib/vacancy-status";

export const dynamic = "force-dynamic";

type VacancyAnalysisView = {
  summary?: string;
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

  const analysis = fromJsonText<VacancyAnalysisView>(vacancy.aiAnalysisJson, {});
  const latestLetter = vacancy.coverLetters[0];

  return (
    <>
      <PageHeader
        title={vacancy.title}
        description={`${vacancy.company?.name || "Компания не указана"} · ${vacancyStatusLabel(vacancy.status)}`}
        action={<LinkButtonGroup vacancyId={vacancy.id} sourceUrl={vacancy.sourceUrl} />}
      />
      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className="grid gap-6">
          <Card>
            <h2 className="text-xl font-semibold tracking-normal">Обзор</h2>
            <div className="mt-4 grid gap-3 text-sm text-[var(--muted)] sm:grid-cols-2">
              <div>Компания: {vacancy.company?.name || "не указана"}</div>
              <div>Зарплата: {vacancy.salaryText || "не указана"}</div>
              <div>Локация: {vacancy.location || "не указана"}</div>
              <div>Формат: {vacancy.workFormat || "не указан"}</div>
              <div>Источник: {vacancy.source}</div>
              <div>Профиль: {vacancy.searchProfile?.title || "не выбран"}</div>
            </div>
            {vacancy.sourceUrl ? (
              <p className="mt-4 break-words text-sm">
                <a href={vacancy.sourceUrl} target="_blank" rel="noreferrer" className="text-[var(--accent)] hover:underline">
                  {vacancy.sourceUrl}
                </a>
              </p>
            ) : null}
            <pre className="mt-5 whitespace-pre-wrap rounded-md border border-[var(--line)] bg-[var(--soft)] p-4 text-sm leading-6">
              {vacancy.rawDescription || "Описание не сохранено."}
            </pre>
          </Card>

          <Card>
            <h2 className="text-xl font-semibold tracking-normal">AI-разбор</h2>
            <div className="mt-4 text-4xl font-semibold tracking-normal">{vacancy.matchScore ?? "—"}</div>
            <p className="mt-3 text-sm leading-6 text-[var(--muted)]">{analysis.summary || "AI-анализ ещё не выполнялся."}</p>
            <List title="Почему подходит" items={analysis.why_matches} />
            <List title="Слабые совпадения" items={analysis.weak_matches} />
            <List title="Красные флаги" items={analysis.red_flags} />
            <List title="Неподтверждённые требования" items={analysis.missing_requirements} />
            <TextBlock title="Ракурс резюме" text={analysis.recommended_resume_angle} />
            <List title="Фокус письма" items={analysis.recommended_cover_letter_focus} />
            <TextBlock title="Короткое объяснение" text={analysis.reasoning_short} />
            <TextBlock title="Следующее действие" text={analysis.suggested_next_action} />
            <TextBlock title="Рекомендация" text={vacancy.recommendation} />
          </Card>

          <Card>
            <h2 className="text-xl font-semibold tracking-normal">Сопроводительное</h2>
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
            <h2 className="text-xl font-semibold tracking-normal">Компания</h2>
            <p className="mt-3 text-sm text-[var(--muted)]">{vacancy.company?.name || "Компания не указана."}</p>
            {vacancy.company?.website ? <p className="mt-2 text-sm">{vacancy.company.website}</p> : null}
            {vacancy.company?.notes ? <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{vacancy.company.notes}</p> : null}
          </Card>

          <Card>
            <h2 className="text-xl font-semibold tracking-normal">История/заметки</h2>
            <div className="mt-4 grid gap-3">
              {vacancy.interactions.length === 0 ? (
                <p className="text-sm text-[var(--muted)]">Событий пока нет.</p>
              ) : (
                vacancy.interactions.map((interaction) => (
                  <div key={interaction.id} className="rounded-md border border-[var(--line)] p-3">
                    <div className="text-sm font-semibold">{interaction.type}</div>
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
            <h2 className="text-lg font-semibold tracking-normal">Score</h2>
            <div className="mt-3 text-5xl font-semibold tracking-normal">{vacancy.finalScore ?? vacancy.matchScore ?? "—"}</div>
          </Card>
        </aside>
      </div>
    </>
  );
}

function LinkButtonGroup({ vacancyId, sourceUrl }: { vacancyId: string; sourceUrl?: string | null }) {
  return (
    <div className="flex flex-wrap gap-2">
      <Link href="/vacancies/new" className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white dark:text-black">
        Добавить вакансию
      </Link>
      {sourceUrl ? <CopyButton text={sourceUrl} label="Скопировать ссылку" /> : null}
      <Link href={`/vacancies/${vacancyId}`} className="rounded-md border border-[var(--line)] px-4 py-2 text-sm">
        Открыть
      </Link>
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
