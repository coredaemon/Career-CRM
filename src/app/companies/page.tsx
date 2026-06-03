import Link from "next/link";
import { CompaniesBackfillButton } from "@/components/companies-backfill-button";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function CompaniesPage() {
  const companies = await prisma.company.findMany({
    orderBy: { name: "asc" },
    include: {
      vacancies: {
        select: {
          id: true,
          status: true,
          title: true,
          createdAt: true,
          applications: { select: { id: true } }
        },
        orderBy: { createdAt: "desc" }
      }
    }
  });

  const vacanciesWithoutCompany = await prisma.vacancy.count({
    where: {
      companyId: null,
      NOT: { source: "manual" }
    }
  });

  return (
    <>
      <PageHeader
        title="Компании"
        description="Компании появляются после сбора или добавления вакансий."
        action={
          vacanciesWithoutCompany > 0 ? (
            <CompaniesBackfillButton count={vacanciesWithoutCompany} />
          ) : null
        }
      />
      {companies.length === 0 ? (
        <div className="grid gap-4">
          <EmptyState
            title="Компаний пока нет"
            description="Компании появляются после сбора или добавления вакансий. Если вакансии уже есть — запустите создание карточек компаний."
          />
          {vacanciesWithoutCompany > 0 ? (
            <div className="flex justify-center">
              <CompaniesBackfillButton count={vacanciesWithoutCompany} />
            </div>
          ) : null}
        </div>
      ) : (
        <div className="grid gap-4">
          {companies.map((company) => {
            const totalVacancies = company.vacancies.length;
            const totalApplications = company.vacancies.reduce(
              (sum, v) => sum + v.applications.length,
              0
            );
            const lastVacancy = company.vacancies[0];
            const activeVacancies = company.vacancies.filter(
              (v) => !["archived", "skipped", "rejected", "no_response"].includes(v.status)
            ).length;

            return (
              <Card key={company.id}>
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <h2 className="text-xl font-semibold tracking-normal">{company.name}</h2>
                    {company.brandName ? (
                      <p className="mt-0.5 text-sm text-[var(--muted)]">{company.brandName}</p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-2 text-sm">
                    <span className="rounded-md bg-[var(--soft)] px-3 py-1">
                      Вакансий: {totalVacancies}
                    </span>
                    {activeVacancies > 0 ? (
                      <span className="rounded-md bg-[var(--soft)] px-3 py-1 text-[var(--accent)]">
                        Активных: {activeVacancies}
                      </span>
                    ) : null}
                    {totalApplications > 0 ? (
                      <span className="rounded-md bg-[var(--soft)] px-3 py-1">
                        Откликов: {totalApplications}
                      </span>
                    ) : null}
                  </div>
                </div>
                {lastVacancy ? (
                  <p className="mt-2 text-sm text-[var(--muted)]">
                    Последняя вакансия:{" "}
                    <Link href={`/vacancies?company=${encodeURIComponent(company.name)}`} className="hover:underline">
                      {lastVacancy.title}
                    </Link>
                    {" "}·{" "}
                    {lastVacancy.createdAt.toLocaleDateString("ru-RU", { day: "2-digit", month: "short", year: "numeric" })}
                  </p>
                ) : null}
                {company.notes ? (
                  <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{company.notes}</p>
                ) : null}
                {company.website ? (
                  <p className="mt-2 text-sm">
                    <a href={company.website} target="_blank" rel="noreferrer" className="text-[var(--accent)] hover:underline">
                      {company.website}
                    </a>
                  </p>
                ) : null}
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
