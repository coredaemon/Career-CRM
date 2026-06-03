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
      aiSummary: true,
      createdAt: true
    }
  });

  return (
    <>
      <PageHeader title="Resumes" description="В MVP можно добавить резюме текстом. PDF/DOCX загрузка появится позже." />
      <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
        <div className="grid content-start gap-4">
          {resumes.length === 0 ? (
            <EmptyState title="Резюме пока нет" description="Добавьте текст резюме здесь или пройдите onboarding для создания первого профиля поиска." />
          ) : (
            resumes.map((resume) => (
              <Card key={resume.id}>
                <h2 className="text-xl font-semibold tracking-normal">{resume.title}</h2>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  {resume.sourceType} · {resume.createdAt.toLocaleDateString("ru-RU")}
                </p>
                {resume.aiSummary ? <p className="mt-3 text-sm leading-6 text-[var(--muted)]">{resume.aiSummary}</p> : null}
              </Card>
            ))
          )}
        </div>
        <AddResumeForm />
      </div>
    </>
  );
}
