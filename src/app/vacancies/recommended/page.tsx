import Link from "next/link";
import { CopyButton } from "@/components/copy-button";
import { VacancyQuickActions } from "@/components/vacancy-quick-actions";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { fromJsonText } from "@/lib/json";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function RecommendedVacanciesPage() {
  const vacancies = await prisma.vacancy.findMany({
    where: {
      OR: [{ status: "ai_recommended" }, { status: "ready_to_apply" }, { matchScore: { gte: 75 } }]
    },
    orderBy: [{ matchScore: "desc" }, { createdAt: "desc" }],
    include: {
      company: true,
      coverLetters: { orderBy: { createdAt: "desc" }, take: 1 }
    }
  });

  const practical = vacancies.filter((vacancy) => {
    const redFlags = fromJsonText<string[]>(vacancy.redFlagsJson, []);
    return redFlags.length < 3 && vacancy.status !== "rejected_by_ai" && vacancy.status !== "archived" && vacancy.status !== "skipped";
  });

  return (
    <>
      <PageHeader
        title="Рекомендованные вакансии"
        description="Практичный список для ручных откликов: открыть hh, скопировать письмо, отправить отклик руками и отметить результат."
      />
      {practical.length === 0 ? (
        <EmptyState
          title="Рекомендованных вакансий пока нет"
          description="Запустите поиск вакансий и AI-анализ. Здесь появятся позиции с высоким score и без критичных красных флагов."
        />
      ) : (
        <div className="grid gap-4">
          {practical.map((vacancy) => {
            const why = fromJsonText<string[]>(vacancy.matchReasonsJson, []).slice(0, 3);
            const redFlags = fromJsonText<string[]>(vacancy.redFlagsJson, []).slice(0, 3);
            const letter = vacancy.coverLetters[0]?.text;
            return (
              <Card key={vacancy.id}>
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <Link href={`/vacancies/${vacancy.id}`} className="text-xl font-semibold tracking-normal hover:text-[var(--accent)]">
                      {vacancy.title}
                    </Link>
                    <p className="mt-1 text-sm text-[var(--muted)]">
                      {vacancy.company?.name || "Компания не указана"} · {vacancy.salaryText || "зарплата не указана"} · {vacancy.workFormat || "формат не указан"}
                    </p>
                  </div>
                  <div className="rounded-md bg-[var(--soft)] px-3 py-2 text-sm">Score: {vacancy.matchScore ?? "нет"}</div>
                </div>
                {why.length ? (
                  <ul className="mt-4 grid gap-2 text-sm leading-6 text-[var(--muted)]">
                    {why.map((item) => (
                      <li key={item}>• {item}</li>
                    ))}
                  </ul>
                ) : null}
                {redFlags.length ? (
                  <div className="mt-4 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
                    <div className="font-medium">Красные флаги</div>
                    <ul className="mt-2 grid gap-1">
                      {redFlags.map((item) => (
                        <li key={item}>• {item}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                <div className="mt-4 flex flex-wrap gap-2">
                  {letter ? <CopyButton text={letter} label="Скопировать письмо" /> : null}
                  <VacancyQuickActions vacancyId={vacancy.id} sourceUrl={vacancy.sourceUrl} />
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
