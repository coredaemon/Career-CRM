import { prisma } from "@/lib/prisma";
import { getUserSettings } from "@/lib/settings";
import { Card, LinkButton, PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const settings = await getUserSettings();
  const [resumes, profiles, vacancies, aiRecommended, readyToApply, applied, companies, applications, needResponseCheck, overdueActions, todayActions] =
    await Promise.all([
      prisma.resume.count(),
      prisma.searchProfile.count(),
      prisma.vacancy.count(),
      prisma.vacancy.count({ where: { status: "ai_recommended" } }),
      prisma.vacancy.count({ where: { status: "ready_to_apply" } }),
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
        where: { nextActionAt: { gte: startOfToday(), lt: startOfTomorrow() } },
        orderBy: { nextActionAt: "asc" },
        take: 5,
        include: { company: true }
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

      <Card className="mt-6">
        <h2 className="text-xl font-semibold tracking-normal">Следующие шаги</h2>
        <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{nextStepText({ vacancies, aiRecommended, readyToApply })}</p>
        <div className="mt-5 flex flex-wrap gap-3">
          {vacancies === 0 ? <LinkButton href="/search">Запустить поиск вакансий</LinkButton> : null}
          {aiRecommended > 0 ? <LinkButton href="/vacancies/recommended">Перейти к рекомендованным</LinkButton> : null}
          {readyToApply > 0 ? <LinkButton href="/vacancies?status=ready_to_apply">Вакансии для отклика</LinkButton> : null}
          <LinkButton href="/vacancies/new">Добавить вручную</LinkButton>
        </div>
      </Card>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <ActionList title="Просроченные действия" vacancies={overdueActions} />
        <ActionList title="Действия на сегодня" vacancies={todayActions} />
      </div>
    </>
  );
}

function nextStepText({ vacancies, aiRecommended, readyToApply }: { vacancies: number; aiRecommended: number; readyToApply: number }) {
  if (vacancies === 0) return "Запустите поиск вакансий по профилю. CareerOS откроет hh в браузере, соберёт карточки и сможет прогнать новые вакансии через AI.";
  if (readyToApply > 0) return "Есть вакансии, куда можно откликнуться прямо сейчас: откройте hh, скопируйте письмо и отправьте отклик вручную.";
  if (aiRecommended > 0) return "AI нашёл подходящие вакансии. Проверьте рекомендованные и решите, какие перевести в готовые к отклику.";
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
