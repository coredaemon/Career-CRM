import Link from "next/link";
import { Prisma } from "@prisma/client";
import { BulkAiAnalyzeButton } from "@/components/bulk-ai-analyze-button";
import { getActiveProcessesSummary } from "@/lib/active-processes";
import { countVacanciesEligibleForBulk } from "@/lib/process-queries";
import { CopyButton } from "@/components/copy-button";
import { VacancyAiRetryButton } from "@/components/vacancy-ai-retry-button";
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
  { label: "Без AI-анализа", status: "no_ai" },
  { label: "Ошибка анализа", status: "analysis_error" },
  { label: "Отклик отправлен", status: "applied" },
  { label: "Архив", status: "archived" }
];

export default async function VacanciesPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status } = await searchParams;
  const where = vacancyWhere(status);
  const [vacancies, totalVacancies, withoutAi, eligibleForBulk, analysisErrors, lastSearchRun, activeSummary] = await Promise.all([
    prisma.vacancy.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        company: true,
        coverLetters: { orderBy: { createdAt: "desc" }, take: 1 }
      }
    }),
    prisma.vacancy.count(),
    prisma.vacancy.count({ where: { OR: [{ matchScore: null }, { aiAnalysisJson: null }] } }),
    countVacanciesEligibleForBulk(),
    prisma.vacancy.count({ where: { status: "analysis_error" } }),
    prisma.searchRun.findFirst({ orderBy: { startedAt: "desc" }, select: { id: true } }),
    getActiveProcessesSummary()
  ]);

  return (
    <>
      <PageHeader
        title="Вакансии"
        description="Очередь вакансий: собранные с hh, ручные, проанализированные AI и готовые к ручному отклику."
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

      {activeSummary.activeVacancyAnalysis ? (
        <Card className="mb-5 border-[var(--accent)]">
          <p className="text-sm font-medium">{activeSummary.activeVacancyAnalysis.humanSummary}</p>
          <p className="mt-1 text-xs text-[var(--muted)]">{activeSummary.activeVacancyAnalysis.etaLabel}</p>
        </Card>
      ) : null}

      {eligibleForBulk > 0 ? (
        <Card className="mb-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-lg font-semibold tracking-normal">
                Готовы к AI-анализу (с профилем поиска): {eligibleForBulk}
              </h2>
              <p className="mt-1 text-sm text-[var(--muted)]">
                Всего без AI-полей: {withoutAi}. Запустите быстрый анализ для score и рекомендаций; письма — отдельно для рекомендованных.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <BulkAiAnalyzeButton />
              {lastSearchRun ? (
                <Link href={`/search/runs/${lastSearchRun.id}`} className="rounded-md border border-[var(--line)] px-4 py-2 text-sm hover:bg-[var(--soft)]">
                  Результаты последнего поиска
                </Link>
              ) : null}
            </div>
          </div>
        </Card>
      ) : null}

      {analysisErrors > 0 ? (
        <Card className="mb-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-lg font-semibold tracking-normal">Ошибки AI-анализа: {analysisErrors}</h2>
              <p className="mt-1 text-sm text-[var(--muted)]">Можно повторить анализ для вакансий с ошибкой формата или сбоя модели.</p>
            </div>
            <BulkAiAnalyzeButton label="Повторить ошибки AI" retryErrorsOnly />
          </div>
        </Card>
      ) : null}

      {vacancies.length === 0 ? (
        <EmptyState
          title={emptyTitle(totalVacancies, status, withoutAi)}
          description={emptyDescription(totalVacancies, status, withoutAi)}
          actions={
            status === "ai_recommended" && withoutAi > 0 ? (
              <div className="mt-4 flex flex-wrap gap-2">
                <BulkAiAnalyzeButton />
                <BulkAiAnalyzeButton label="Повторить ошибки AI" retryErrorsOnly />
                {lastSearchRun ? (
                  <Link href={`/search/runs/${lastSearchRun.id}`} className="rounded-md border border-[var(--line)] px-4 py-2 text-sm">
                    Результаты последнего поиска
                  </Link>
                ) : null}
              </div>
            ) : undefined
          }
        />
      ) : (
        <div className="grid gap-4">
          {vacancies.map((vacancy) => {
            const analysis = fromJsonText<{ summary?: string }>(vacancy.aiAnalysisJson, {});
            const redFlags = fromJsonText<string[]>(vacancy.redFlagsJson, []);
            const latestLetter = vacancy.coverLetters[0]?.text;
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
                {!vacancy.aiAnalysisJson ? (
                  <p className="mt-4 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
                    Эта вакансия ещё без AI-анализа. Запустите анализ, чтобы получить score и письмо.
                  </p>
                ) : null}
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <span className="rounded-md bg-[var(--soft)] px-3 py-1 text-sm">Красные флаги: {redFlags.length}</span>
                  {vacancy.nextActionType ? <span className="rounded-md bg-[var(--soft)] px-3 py-1 text-sm">Действие: {vacancy.nextActionType}</span> : null}
                  <Link href={`/vacancies/${vacancy.id}`} className="rounded-md border border-[var(--line)] px-4 py-2 text-sm hover:bg-[var(--soft)]">
                    Открыть
                  </Link>
                  {vacancy.sourceUrl ? <CopyButton text={vacancy.sourceUrl} label="Скопировать ссылку" /> : null}
                  {latestLetter ? <CopyButton text={latestLetter} label="Скопировать письмо" /> : null}
                  <VacancyQuickActions vacancyId={vacancy.id} sourceUrl={vacancy.sourceUrl} />
                  <VacancyAiRetryButton vacancyId={vacancy.id} />
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

function vacancyWhere(status?: string): Prisma.VacancyWhereInput | undefined {
  if (!status) return undefined;
  if (status === "no_ai") return { OR: [{ matchScore: null }, { aiAnalysisJson: null }] };
  if (status === "ai_recommended") return { status: "ai_recommended" };
  if (status === "ready_to_apply") {
    return {
      status: "ready_to_apply",
      coverLetters: { some: {} }
    };
  }
  return { status };
}

function emptyTitle(totalVacancies: number, status?: string, withoutAi?: number) {
  if (totalVacancies === 0) return "Вакансий пока нет";
  if (status === "ai_recommended" && withoutAi) return "Рекомендованных пока нет";
  if (status === "no_ai") return "Все вакансии уже проанализированы";
  return "В этой вкладке пока пусто";
}

function emptyDescription(totalVacancies: number, status?: string, withoutAi?: number) {
  if (totalVacancies === 0) return "Запустите поиск вакансий или добавьте вакансию вручную.";
  if (status === "ai_recommended" && withoutAi) return "Есть собранные вакансии без AI-анализа. Запустите анализ, чтобы получить рекомендации.";
  if (status === "no_ai") return "Новых вакансий без AI-анализа нет.";
  return "Попробуйте другой фильтр или запустите AI-анализ для собранных вакансий.";
}

function sourceLabel(source: string) {
  if (source === "manual") return "ручной ввод";
  if (source === "other") return "другой источник";
  return source;
}
