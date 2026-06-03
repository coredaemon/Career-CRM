import Link from "next/link";
import { CopyButton } from "@/components/copy-button";
import { VacancyQuickActions } from "@/components/vacancy-quick-actions";
import { VacancyStatusSelect } from "@/components/vacancy-status-select";
import { Card, EmptyState, LinkButton, PageHeader } from "@/components/ui";
import { fromJsonText } from "@/lib/json";
import { prisma } from "@/lib/prisma";
import { vacancyStatusLabel } from "@/lib/vacancy-status";

export const dynamic = "force-dynamic";

const tabs = [
  { label: "Все", status: "" },
  { label: "AI рекомендует", status: "ai_recommended" },
  { label: "На проверке", status: "needs_review" },
  { label: "Готово к отклику", status: "ready_to_apply" },
  { label: "Отклик отправлен", status: "applied" },
  { label: "Архив", status: "archived" }
];

export default async function VacanciesPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status } = await searchParams;
  const vacancies = await prisma.vacancy.findMany({
    where: status ? { status } : undefined,
    orderBy: { createdAt: "desc" },
    include: {
      company: true,
      coverLetters: { select: { id: true } }
    }
  });

  return (
    <>
      <PageHeader
        title="Вакансии"
        description="Ручной список вакансий с AI-разбором, статусами и сопроводительными письмами."
        action={
          <div className="flex flex-wrap gap-2">
            <LinkButton href="/search">Запустить поиск</LinkButton>
            <LinkButton href="/vacancies/new">Добавить вакансию</LinkButton>
          </div>
        }
      />
      <div className="mb-5 flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <Link
            key={tab.label}
            href={tab.status ? `/vacancies?status=${tab.status}` : "/vacancies"}
            className={`rounded-md border px-3 py-2 text-sm ${
              (status || "") === tab.status ? "border-[var(--accent)] bg-[var(--soft)]" : "border-[var(--line)]"
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </div>
      {vacancies.length === 0 ? (
        <EmptyState title="Вакансий пока нет" description="Добавьте вакансию вручную. CareerOS не собирает вакансии автоматически." />
      ) : (
        <div className="grid gap-4">
          {vacancies.map((vacancy) => {
            const analysis = fromJsonText<{ summary?: string }>(vacancy.aiAnalysisJson, {});
            const redFlags = fromJsonText<string[]>(vacancy.redFlagsJson, []);
            return (
              <Card key={vacancy.id}>
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <Link href={`/vacancies/${vacancy.id}`} className="text-xl font-semibold tracking-normal hover:text-[var(--accent)]">
                      {vacancy.title}
                    </Link>
                    <p className="mt-1 text-sm text-[var(--muted)]">
                      {vacancy.company?.name || "Компания не указана"} · {sourceLabel(vacancy.source)}
                    </p>
                  </div>
                  <span className="w-fit rounded-md border border-[var(--line)] px-3 py-1 text-sm">{vacancyStatusLabel(vacancy.status)}</span>
                </div>
                <div className="mt-4 grid gap-3 text-sm text-[var(--muted)] sm:grid-cols-2 lg:grid-cols-4">
                  <div>{vacancy.salaryText || "Зарплата не указана"}</div>
                  <div>{vacancy.location || "Город / регион не указан"}</div>
                  <div>{vacancy.workFormat || "Формат не указан"}</div>
                  <div>Совпадение: {vacancy.matchScore ?? "нет"}</div>
                </div>
                {analysis.summary ? <p className="mt-4 text-sm leading-6 text-[var(--muted)]">{analysis.summary}</p> : null}
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <span className="rounded-md bg-[var(--soft)] px-3 py-1 text-sm">Красные флаги: {redFlags.length}</span>
                  {vacancy.nextActionType ? <span className="rounded-md bg-[var(--soft)] px-3 py-1 text-sm">Действие: {vacancy.nextActionType}</span> : null}
                  <Link href={`/vacancies/${vacancy.id}`} className="rounded-md border border-[var(--line)] px-4 py-2 text-sm hover:bg-[var(--soft)]">
                    Открыть
                  </Link>
                  {vacancy.sourceUrl ? <CopyButton text={vacancy.sourceUrl} label="Скопировать ссылку" /> : null}
                  <VacancyQuickActions vacancyId={vacancy.id} sourceUrl={vacancy.sourceUrl} />
                  <div className="min-w-56">
                    <VacancyStatusSelect vacancyId={vacancy.id} currentStatus={vacancy.status} />
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}

function sourceLabel(source: string) {
  if (source === "manual") return "ручной ввод";
  if (source === "other") return "другой источник";
  return source;
}
