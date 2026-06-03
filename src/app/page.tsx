import { prisma } from "@/lib/prisma";
import { getUserSettings } from "@/lib/settings";
import { Card, LinkButton, PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const settings = await getUserSettings();
  const [resumes, profiles, vacancies, aiRecommended, readyToApply, companies, applications, overdueActions, todayActions, upcomingActions] =
    await Promise.all([
      prisma.resume.count(),
      prisma.searchProfile.count(),
      prisma.vacancy.count(),
      prisma.vacancy.count({ where: { status: "ai_recommended" } }),
      prisma.vacancy.count({ where: { status: "ready_to_apply" } }),
      prisma.company.count(),
      prisma.application.count(),
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
      }),
      prisma.vacancy.findMany({
        where: { nextActionAt: { gte: startOfTomorrow() } },
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
            Мастер проведёт через настройку AI, вставку текста резюме, анализ и создание первого профиля поиска. CareerOS не отправляет
            отклики автоматически и не автоматизирует hh.
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
    ["AI рекомендует", aiRecommended],
    ["Готовы к отклику", readyToApply],
    ["Отклики", applications],
    ["Компании", companies]
  ];

  const nextStep =
    vacancies === 0
      ? "Добавьте вакансию вручную и запустите AI-разбор."
      : readyToApply > 0
        ? "Есть вакансии, готовые к отклику: отправьте отклик вручную и отметьте статус."
        : aiRecommended > 0
          ? "Посмотрите вакансии, которые рекомендует AI, и решите, какие готовить к отклику."
          : "Разберите новые вакансии или переведите подходящие в следующий статус.";

  return (
    <>
      <PageHeader title="Главная" description="Локальная картина поиска работы без внешней автоматизации." />
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
        <p className="mt-2 text-sm text-[var(--muted)]">{nextStep}</p>
        <div className="mt-5 flex flex-wrap gap-3">
          <LinkButton href="/vacancies/new">Добавить вакансию</LinkButton>
          <LinkButton href="/vacancies?status=ai_recommended">Вакансии, которые рекомендует AI</LinkButton>
        </div>
      </Card>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <ActionList title="Просроченные действия" vacancies={overdueActions} />
        <ActionList title="Действия на сегодня" vacancies={todayActions} />
        <ActionList title="Ближайшие действия" vacancies={upcomingActions} />
      </div>
    </>
  );
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
