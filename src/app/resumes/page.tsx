import Link from "next/link";
import { AddResumeForm } from "@/components/add-resume-form";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function ResumesPage() {
  const resumes = await prisma.resume.findMany({
    orderBy: [{ isActive: "desc" }, { isArchived: "asc" }, { updatedAt: "desc" }],
    select: {
      id: true,
      title: true,
      sourceType: true,
      sourceFileName: true,
      aiSummary: true,
      aiSummaryStale: true,
      confirmedFacts: true,
      isActive: true,
      isArchived: true,
      createdAt: true,
      updatedAt: true,
      _count: {
        select: {
          searchProfiles: true,
          applications: true,
          coverLetters: true
        }
      }
    }
  });

  return (
    <>
      <PageHeader
        title="Резюме"
        description="Управляйте несколькими версиями резюме: добавляйте новое, редактируйте текст, назначайте активное и создавайте профили поиска без повторного первого запуска."
      />
      <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
        <div className="grid content-start gap-4">
          {resumes.length === 0 ? (
            <EmptyState
              title="Резюме пока нет"
              description="Добавьте резюме текстом или PDF-файлом. PDF не сохраняется в репозиторий: извлекается только текст, который остаётся в локальной базе."
            />
          ) : (
            resumes.map((resume) => (
              <Card key={resume.id} className={resume.isArchived ? "opacity-70" : ""}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <Link href={`/resumes/${resume.id}`} className="text-xl font-semibold tracking-normal hover:text-[var(--accent)]">
                      {resume.title}
                    </Link>
                    <p className="mt-1 text-sm text-[var(--muted)]">
                      {resume.sourceType === "text" ? "текст" : "файл"} · {resume.sourceFileName || "без имени файла"} · обновлено{" "}
                      {resume.updatedAt.toLocaleDateString("ru-RU")}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {resume.isActive ? <Badge>активное</Badge> : null}
                    {resume.isArchived ? <Badge>архив</Badge> : null}
                    {resume.aiSummaryStale ? <Badge>AI-анализ устарел</Badge> : null}
                  </div>
                </div>
                <div className="mt-4 grid gap-2 text-sm text-[var(--muted)] sm:grid-cols-3">
                  <Metric label="Профилей поиска" value={resume._count.searchProfiles} />
                  <Metric label="Писем" value={resume._count.coverLetters} />
                  <Metric label="Откликов" value={resume._count.applications} />
                </div>
                <div className="mt-3 flex flex-wrap gap-2 text-xs text-[var(--muted)]">
                  <span className="rounded-md bg-[var(--soft)] px-2 py-1">{resume.aiSummary ? "AI-анализ есть" : "AI-анализ не выполнен"}</span>
                  <span className="rounded-md bg-[var(--soft)] px-2 py-1">
                    {resume.confirmedFacts ? "подтверждённые факты заполнены" : "факты для писем не заполнены"}
                  </span>
                </div>
              </Card>
            ))
          )}
        </div>
        <AddResumeForm />
      </div>
    </>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return <span className="rounded-md border border-[var(--line)] px-3 py-1 text-xs text-[var(--muted)]">{children}</span>;
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md bg-[var(--soft)] p-3">
      <div className="text-xs">{label}</div>
      <div className="mt-1 text-lg font-semibold text-[var(--foreground)]">{value}</div>
    </div>
  );
}

