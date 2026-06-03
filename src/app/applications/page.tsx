import Link from "next/link";
import { ApplicationQuickActions } from "@/components/application-quick-actions";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { buildFollowUpText } from "@/lib/follow-up";
import { prisma } from "@/lib/prisma";
import { vacancyStatusLabel } from "@/lib/vacancy-status";

export const dynamic = "force-dynamic";

function daysUntilCheck(date: Date | null) {
  if (!date) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

export default async function ApplicationsPage() {
  const applications = await prisma.application.findMany({
    orderBy: { appliedAt: "desc" },
    include: {
      vacancy: { include: { company: true } },
      coverLetter: true
    }
  });

  return (
    <>
      <PageHeader
        title="Отклики"
        description="Отправленные отклики и следующие шаги. CareerOS не отправляет отклики автоматически."
      />

      {applications.length === 0 ? (
        <EmptyState
          title="Откликов пока нет"
          description="Когда вы отметите «Отклик отправлен» на вакансии с письмом, отклик появится здесь."
          actions={
            <Link href="/vacancies?status=ready_to_apply" className="mt-4 inline-block rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white dark:text-black">
              Открыть очередь откликов
            </Link>
          }
        />
      ) : (
        <div className="grid gap-4">
          {applications.map((application) => {
            const vacancy = application.vacancy;
            const daysLeft = daysUntilCheck(application.nextActionAt ?? vacancy.nextActionAt);
            const followUpText = buildFollowUpText({
              title: vacancy.title,
              status: vacancy.status,
              testStatus: vacancy.testStatus
            });

            return (
              <Card key={application.id}>
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <Link href={`/vacancies/${vacancy.id}`} className="text-xl font-semibold tracking-normal hover:text-[var(--accent)]">
                      {vacancy.title}
                    </Link>
                    <p className="mt-1 text-sm text-[var(--muted)]">{vacancy.company?.name || "Компания не указана"}</p>
                  </div>
                  <span className="w-fit rounded-md border border-[var(--line)] px-3 py-1 text-sm">
                    {vacancyStatusLabel(vacancy.status)}
                  </span>
                </div>
                <div className="mt-4 grid gap-2 text-sm text-[var(--muted)] sm:grid-cols-2 lg:grid-cols-4">
                  <div>Дата отклика: {application.appliedAt?.toLocaleDateString("ru-RU") || "—"}</div>
                  <div>Статус отклика: {application.status}</div>
                  <div>Следующее действие: {vacancy.nextActionType || "—"}</div>
                  <div>
                    {daysLeft !== null
                      ? daysLeft > 0
                        ? `Проверить через ${daysLeft} дн.`
                        : daysLeft === 0
                          ? "Проверить сегодня"
                          : `Просрочено на ${Math.abs(daysLeft)} дн.`
                      : "Дата проверки не задана"}
                  </div>
                </div>
                {vacancy.nextActionNote ? <p className="mt-3 text-sm text-[var(--muted)]">{vacancy.nextActionNote}</p> : null}
                <div className="mt-4">
                  <ApplicationQuickActions
                    applicationId={application.id}
                    vacancyId={vacancy.id}
                    followUpText={followUpText}
                  />
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
