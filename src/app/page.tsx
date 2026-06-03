import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getActiveProcessesSummary } from "@/lib/active-processes";
import { getUserSettings } from "@/lib/settings";
import { BulkAiAnalyzeButton } from "@/components/bulk-ai-analyze-button";
import { BulkCreateLettersButton } from "@/components/bulk-create-letters-button";
import { ApplicationQuickActions } from "@/components/application-quick-actions";
import { Card, LinkButton, PageHeader } from "@/components/ui";
import { recommendedWithoutLetterWhere, readyToApplyTabWhere } from "@/lib/vacancy-application-queue";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const settings = await getUserSettings();
  const activeProcesses = await getActiveProcessesSummary();
  const endOfToday = startOfTomorrow();

  const [
    resumes,
    profiles,
    vacancies,
    withoutAi,
    aiRecommended,
    readyToApply,
    recommendedWithoutLetter,
    applied,
    companies,
    applications,
    needResponseCheck,
    overdueActions,
    todayActions,
    applicationsToCheck
  ] = await Promise.all([
    prisma.resume.count(),
    prisma.searchProfile.count(),
    prisma.vacancy.count(),
    activeProcesses.eligibleForBulk,
    prisma.vacancy.count({ where: { OR: [{ status: "ai_recommended" }, { status: "ready_to_apply" }] } }),
    prisma.vacancy.count({ where: readyToApplyTabWhere() }),
    prisma.vacancy.count({ where: recommendedWithoutLetterWhere() }),
    prisma.vacancy.count({ where: { status: "applied" } }),
    prisma.company.count(),
    prisma.application.count(),
    prisma.vacancy.count({ where: { nextActionType: "проверить ответ" } }),
    prisma.vacancy.findMany({
      where: { nextActionAt: { lt: startOfToday() } },
      orderBy: { nextActionAt: "asc" },
      take: 5,
      include: { company: true }
    }),
    prisma.vacancy.findMany({
      where: { nextActionAt: { gte: startOfToday(), lt: endOfToday } },
      orderBy: { nextActionAt: "asc" },
      take: 5,
      include: { company: true }
    }),
    prisma.application.findMany({
      where: {
        OR: [{ nextActionAt: { lte: endOfToday } }, { vacancy: { nextActionAt: { lte: endOfToday }, nextActionType: "проверить ответ" } }]
      },
      orderBy: { appliedAt: "desc" },
      take: 5,
      include: { vacancy: { include: { company: true } } }
    })
  ]);

  if (!settings.onboardingCompleted) {
    return (
      <>
        <PageHeader
          title="CareerOS"
          description="Локальная CRM начинается пустой. Первый профиль поиска появится только после анализа вашего резюме и вашего подтверждения."
        />
        <Card className="max-w-3xl">
          <h2 className="text-2xl font-semibold tracking-normal">Настройте безопасное ядро</h2>
          <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
            Мастер проведёт через настройку AI, добавление резюме, анализ и создание первого профиля поиска. CareerOS не отправляет отклики автоматически.
          </p>
          <div className="mt-6">
            <LinkButton href="/onboarding">Пройти первичную настройку</LinkButton>
          </div>
        </Card>
      </>
    );
  }

  const stats = [
    ["Резюме", resumes],
    ["Профили поиска", profiles],
    ["Вакансии", vacancies],
    ["Без AI-анализа", withoutAi],
    ["Рекомендованные", aiRecommended],
    ["Готовы к отклику", readyToApply],
    ["Отклики отправлены", applied],
    ["Нужно проверить ответы", needResponseCheck],
    ["Компании", companies],
    ["Отклики в CRM", applications]
  ];

  return (
    <>
      <PageHeader title="Главная" description="Рабочая картина поиска: что найдено, куда можно откликаться и какие действия пора выполнить." />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map(([label, value]) => (
          <Card key={label.toString()}>
            <div className="text-sm text-[var(--muted)]">{label}</div>
            <div className="mt-3 text-4xl font-semibold tracking-normal">{value}</div>
          </Card>
        ))}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
        <Card>
          <h2 className="text-lg font-semibold tracking-normal">Готово к отклику</h2>
          <p className="mt-2 text-3xl font-semibold">{readyToApply}</p>
          <p className="mt-1 text-sm text-[var(--muted)]">Вакансии с письмами для ручного отклика на hh.</p>
          <div className="mt-4">
            <LinkButton href="/vacancies?status=ready_to_apply">Открыть очередь откликов</LinkButton>
          </div>
        </Card>
        <Card>
          <h2 className="text-lg font-semibold tracking-normal">Рекомендованные без писем</h2>
          <p className="mt-2 text-3xl font-semibold">{recommendedWithoutLetter}</p>
          <p className="mt-1 text-sm text-[var(--muted)]">Нужно создать сопроводительные письма перед откликом.</p>
          <div className="mt-4">
            <BulkCreateLettersButton />
          </div>
        </Card>
        <Card className="lg:col-span-2">
          <h2 className="text-lg font-semibold tracking-normal">Отклики на проверку</h2>
          {applicationsToCheck.length === 0 ? (
            <p className="mt-3 text-sm text-[var(--muted)]">Нет откликов, которые пора проверить.</p>
          ) : (
            <div className="mt-4 grid gap-3">
              {applicationsToCheck.map((application) => (
                <div key={application.id} className="rounded-md border border-[var(--line)] p-3 text-sm">
                  <Link href={`/vacancies/${application.vacancy.id}`} className="font-medium hover:text-[var(--accent)]">
                    {application.vacancy.title}
                  </Link>
                  <p className="mt-1 text-[var(--muted)]">{application.vacancy.company?.name || "Компания не указана"}</p>
                  <div className="mt-3">
                    <ApplicationQuickActions applicationId={application.id} vacancyId={application.vacancy.id} />
                  </div>
                </div>
              ))}
            </div>
          )}
          <Link href="/applications" className="mt-4 inline-block text-sm underline">
            Все отклики
          </Link>
        </Card>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="text-xl font-semibold tracking-normal">Активные процессы</h2>
          {activeProcesses.searchRuns.length === 0 && activeProcesses.processRuns.length === 0 ? (
            <p className="mt-3 text-sm text-[var(--muted)]">Сейчас нет активных или зависших процессов.</p>
          ) : (
            <div className="mt-4 grid gap-3 text-sm">
              {activeProcesses.searchRuns.map((run) => (
                <div key={run.id} className="rounded-md border border-[var(--line)] p-3">
                  <Link href={run.href} className="font-medium hover:text-[var(--accent)]">
                    Поиск: {run.title}
                  </Link>
                  <p className="mt-1 text-xs text-[var(--muted)]">{run.state?.humanSummary ?? run.status}</p>
                </div>
              ))}
              {activeProcesses.processRuns.map((run) => (
                <div key={run.id} className="rounded-md border border-[var(--line)] p-3">
                  <Link href={run.href} className="font-medium hover:text-[var(--accent)]">
                    {run.title}
                  </Link>
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    {run.state?.humanSummary ?? `${run.progressCurrent} / ${run.progressTotal}`}
                  </p>
                </div>
              ))}
            </div>
          )}
          <Link href="/processes" className="mt-4 inline-block text-sm underline">
            Все процессы
          </Link>
        </Card>

        <Card>
          <h2 className="text-xl font-semibold tracking-normal">Что делать дальше</h2>
          {activeProcesses.actions.length === 0 ? (
            <p className="mt-3 text-sm text-[var(--muted)]">
              {nextStepText({ vacancies, withoutAi, aiRecommended, readyToApply, recommendedWithoutLetter, applied, needResponseCheck })}
            </p>
          ) : (
            <ul className="mt-4 grid gap-2 text-sm">
              {activeProcesses.actions.map((action) => (
                <li key={action.href} className="rounded-md border border-[var(--line)] p-3">
                  <p>{action.message}</p>
                  <Link href={action.href} className="mt-2 inline-block text-xs underline">
                    {action.label}
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-5 flex flex-wrap gap-3">
            {vacancies === 0 ? <LinkButton href="/search">Запустить поиск вакансий</LinkButton> : null}
            {withoutAi > 0 ? <BulkAiAnalyzeButton label="Проанализировать вакансии" /> : null}
            {recommendedWithoutLetter > 0 ? <BulkCreateLettersButton /> : null}
            {readyToApply > 0 ? <LinkButton href="/vacancies?status=ready_to_apply">Вакансии для отклика</LinkButton> : null}
            {needResponseCheck > 0 ? <LinkButton href="/applications">Проверить отклики</LinkButton> : null}
            <LinkButton href="/vacancies/new">Добавить вручную</LinkButton>
          </div>
        </Card>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <ActionList title="Просроченные действия" vacancies={overdueActions} />
        <ActionList title="Действия на сегодня" vacancies={todayActions} />
      </div>
    </>
  );
}

function nextStepText({
  vacancies,
  withoutAi,
  aiRecommended,
  readyToApply,
  recommendedWithoutLetter,
  applied,
  needResponseCheck
}: {
  vacancies: number;
  withoutAi: number;
  aiRecommended: number;
  readyToApply: number;
  recommendedWithoutLetter: number;
  applied: number;
  needResponseCheck: number;
}) {
  if (vacancies === 0) return "Запустите поиск вакансий по профилю. CareerOS откроет hh в браузере, соберёт карточки и сможет прогнать новые вакансии через AI.";
  if (withoutAi > 0) return "Есть собранные вакансии без AI-анализа. Запустите быстрый AI-анализ, чтобы получить score и рекомендации.";
  if (recommendedWithoutLetter > 0) return "Есть AI-рекомендованные вакансии без писем. Создайте сопроводительные письма для очереди откликов.";
  if (readyToApply > 0) return "Есть вакансии с письмами — откройте hh, скопируйте письмо и отправьте отклик вручную, затем отметьте «Отклик отправлен».";
  if (needResponseCheck > 0 || applied > 0) return "Пора проверить ответы работодателей по отправленным откликам.";
  if (aiRecommended > 0) return "AI нашёл подходящие вакансии. Создайте письма и переведите лучшие в готовые к отклику.";
  return "Продолжайте разбор найденных вакансий или запустите новый поиск небольшими партиями.";
}

function ActionList({
  title,
  vacancies
}: {
  title: string;
  vacancies: Array<{ id: string; title: string; nextActionType: string | null; nextActionAt: Date | null; company: { name: string } | null }>;
}) {
  return (
    <Card>
      <h2 className="text-lg font-semibold tracking-normal">{title}</h2>
      {vacancies.length === 0 ? (
        <p className="mt-3 text-sm text-[var(--muted)]">Нет задач.</p>
      ) : (
        <div className="mt-4 grid gap-3">
          {vacancies.map((vacancy) => (
            <a key={vacancy.id} href={`/vacancies/${vacancy.id}`} className="rounded-md border border-[var(--line)] p-3 text-sm hover:bg-[var(--soft)]">
              <div className="font-medium">{vacancy.nextActionType || "Следующее действие"}</div>
              <div className="mt-1 text-[var(--muted)]">
                {vacancy.title}
                {vacancy.company ? ` · ${vacancy.company.name}` : ""}
              </div>
              {vacancy.nextActionAt ? <div className="mt-1 text-xs text-[var(--muted)]">{vacancy.nextActionAt.toLocaleString("ru-RU")}</div> : null}
            </a>
          ))}
        </div>
      )}
    </Card>
  );
}

function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function startOfTomorrow() {
  const date = startOfToday();
  date.setDate(date.getDate() + 1);
  return date;
}
