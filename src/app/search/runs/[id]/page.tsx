import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, PageHeader } from "@/components/ui";
import { fromJsonText } from "@/lib/json";
import { prisma } from "@/lib/prisma";
import { vacancyStatusLabel } from "@/lib/vacancy-status";

export const dynamic = "force-dynamic";

export default async function SearchRunDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const run = await prisma.searchRun.findUnique({
    where: { id },
    include: {
      searchProfile: true,
      items: {
        orderBy: { createdAt: "desc" },
        include: {
          vacancy: { include: { company: true } }
        }
      }
    }
  });

  if (!run) notFound();

  const logs = fromJsonText<string[]>(run.logJson, []);
  const errors = fromJsonText<string[]>(run.errorLogJson, []);
  const queries = fromJsonText<string[]>(run.queriesJson, []);
  const progress = fromJsonText<Record<string, number>>(run.progressJson, {});

  return (
    <>
      <PageHeader
        title="Детали поиска"
        description={`${run.searchProfile?.title || "Профиль удалён"} · ${searchRunStatusLabel(run.status)} · ${run.startedAt.toLocaleString("ru-RU")}`}
      />
      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className="grid gap-6">
          <Card>
            <h2 className="text-xl font-semibold tracking-normal">Статистика</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <Metric label="Найдено" value={run.totalFound} />
              <Metric label="Новых" value={run.totalCreated} />
              <Metric label="Дублей" value={run.totalDuplicates} />
              <Metric label="AI" value={run.totalAnalyzed} />
              <Metric label="Ошибок" value={run.totalErrors} />
              <Metric label="Рекомендовано" value={progress.recommended || 0} />
              <Metric label="На проверке" value={progress.needsReview || 0} />
            </div>
          </Card>

          <Card>
            <h2 className="text-xl font-semibold tracking-normal">Найденные вакансии</h2>
            {run.items.length === 0 ? (
              <p className="mt-3 text-sm text-[var(--muted)]">Вакансии в этом запуске не сохранены.</p>
            ) : (
              <div className="mt-4 grid gap-3">
                {run.items.map((item) => (
                  <div key={item.id} className="rounded-md border border-[var(--line)] p-3 text-sm">
                    {item.vacancy ? (
                      <>
                        <Link href={`/vacancies/${item.vacancy.id}`} className="font-medium hover:text-[var(--accent)]">
                          {item.vacancy.title}
                        </Link>
                        <div className="mt-1 text-xs text-[var(--muted)]">
                          {item.vacancy.company?.name || "компания не указана"} · {vacancyStatusLabel(item.vacancy.status)} · {item.status}
                        </div>
                      </>
                    ) : (
                      <div className="font-medium">{item.sourceUrl}</div>
                    )}
                    {item.errorMessage ? <p className="mt-2 text-xs text-amber-700">{item.errorMessage}</p> : null}
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card>
            <h2 className="text-xl font-semibold tracking-normal">Лог запуска</h2>
            <div className="mt-4 max-h-96 overflow-auto rounded-md border border-[var(--line)] bg-[var(--soft)] p-3 text-sm leading-6">
              {logs.length ? logs.map((item) => <div key={item}>{item}</div>) : <p className="text-[var(--muted)]">Лог пуст.</p>}
            </div>
          </Card>
        </div>

        <aside className="grid content-start gap-4">
          <Card>
            <h2 className="text-lg font-semibold tracking-normal">Запросы</h2>
            <ul className="mt-3 grid gap-2 text-sm text-[var(--muted)]">
              {queries.map((query) => (
                <li key={query}>• {query}</li>
              ))}
            </ul>
          </Card>
          <Card>
            <h2 className="text-lg font-semibold tracking-normal">Ошибки</h2>
            {errors.length ? (
              <ul className="mt-3 grid gap-2 text-sm text-[var(--muted)]">
                {errors.map((error) => (
                  <li key={error}>• {error}</li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-[var(--muted)]">Ошибок нет.</p>
            )}
          </Card>
        </aside>
      </div>
    </>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-[var(--line)] p-3">
      <div className="text-xs text-[var(--muted)]">{label}</div>
      <div className="mt-2 text-2xl font-semibold tracking-normal">{value}</div>
    </div>
  );
}

function searchRunStatusLabel(status: string) {
  const labels: Record<string, string> = {
    running: "выполняется",
    completed: "завершён",
    error: "ошибка",
    stopped: "остановлен"
  };
  return labels[status] || status;
}
