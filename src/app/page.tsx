import { prisma } from "@/lib/prisma";
import { getUserSettings } from "@/lib/settings";
import { Card, LinkButton, PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const settings = await getUserSettings();
  const [resumes, profiles, vacancies, companies, applications] = await Promise.all([
    prisma.resume.count(),
    prisma.searchProfile.count(),
    prisma.vacancy.count(),
    prisma.company.count(),
    prisma.application.count()
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
            Мастер проведет через AI-настройки, вставку текста резюме, анализ и сохранение первого профиля поиска. В MVP-1 CareerOS не
            отправляет отклики и не автоматизирует hh.
          </p>
          <div className="mt-6">
            <LinkButton href="/onboarding">Пройти мастер</LinkButton>
          </div>
        </Card>
      </>
    );
  }

  const stats = [
    ["Резюме", resumes],
    ["Профили поиска", profiles],
    ["Вакансии", vacancies],
    ["Компании", companies],
    ["Отклики", applications]
  ];

  return (
    <>
      <PageHeader title="Dashboard" description="Локальная картина поиска работы без внешней автоматизации." />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {stats.map(([label, value]) => (
          <Card key={label.toString()}>
            <div className="text-sm text-[var(--muted)]">{label}</div>
            <div className="mt-3 text-4xl font-semibold tracking-normal">{value}</div>
          </Card>
        ))}
      </div>
      <Card className="mt-6">
        <h2 className="text-xl font-semibold tracking-normal">Следующий шаг</h2>
        <p className="mt-2 text-sm text-[var(--muted)]">Следующий этап — добавить сбор вакансий и AI-анализ вакансий.</p>
      </Card>
    </>
  );
}
