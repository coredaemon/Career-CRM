import Link from "next/link";
import { AddResumeForm } from "@/components/add-resume-form";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function ResumesPage() {
  const resumes = await prisma.resume.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      sourceType: true,
      sourceFileName: true,
      aiSummary: true,
      confirmedFacts: true,
      createdAt: true
    }
  });

  return (
    <>
      <PageHeader
        title="Резюме"
        description="Загрузите PDF с текстовым слоем или вставьте текст вручную. Перед сохранением и AI-анализом текст можно поправить."
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
              <Card key={resume.id}>
                <Link href={`/resumes/${resume.id}`} className="text-xl font-semibold tracking-normal hover:text-[var(--accent)]">
                  {resume.title}
                </Link>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  {resume.sourceType === "text" ? "текст" : "файл"} · {resume.sourceFileName || "без имени файла"} ·{" "}
                  {resume.createdAt.toLocaleDateString("ru-RU")}
                </p>
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
