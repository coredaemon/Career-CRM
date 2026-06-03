import Link from "next/link";
import { notFound } from "next/navigation";
import { ResumeActions } from "@/components/resume-actions";
import { ResumeDetailEditor } from "@/components/resume-detail-editor";
import { Card, PageHeader } from "@/components/ui";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function ResumeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const resume = await prisma.resume.findUnique({
    where: { id },
    include: {
      searchProfiles: {
        orderBy: [{ isActive: "desc" }, { updatedAt: "desc" }]
      },
      _count: {
        select: {
          applications: true,
          coverLetters: true,
          searchProfiles: true
        }
      }
    }
  });

  if (!resume) notFound();

  return (
    <>
      <PageHeader
        title={resume.title}
        description={`${resume.sourceType === "file" ? "PDF / файл" : "Текст"}${resume.sourceFileName ? ` · ${resume.sourceFileName}` : ""}`}
        action={
          <div className="flex flex-wrap gap-2">
            {resume.isActive ? <Badge>активное</Badge> : null}
            {resume.isArchived ? <Badge>архив</Badge> : null}
            {resume.aiSummaryStale ? <Badge>AI-анализ устарел</Badge> : null}
          </div>
        }
      />
      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <ResumeDetailEditor
          resume={{
            id: resume.id,
            title: resume.title,
            originalText: resume.originalText,
            aiSummary: resume.aiSummary,
            aiSummaryStale: resume.aiSummaryStale,
            confirmedFacts: resume.confirmedFacts
          }}
        />
        <aside className="grid content-start gap-4">
          <ResumeActions resume={{ id: resume.id, isActive: resume.isActive, isArchived: resume.isArchived }} />
          <Card>
            <h2 className="text-lg font-semibold tracking-normal">Использование</h2>
            <div className="mt-4 grid gap-2 text-sm text-[var(--muted)]">
              <Row label="Профилей поиска" value={resume._count.searchProfiles} />
              <Row label="Писем" value={resume._count.coverLetters} />
              <Row label="Откликов" value={resume._count.applications} />
            </div>
          </Card>
          <Card>
            <h2 className="text-lg font-semibold tracking-normal">Связанные профили поиска</h2>
            {resume.searchProfiles.length === 0 ? (
              <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
                Профилей пока нет. Создайте профиль из этого резюме, чтобы он появился в поиске вакансий.
              </p>
            ) : (
              <div className="mt-4 grid gap-3">
                {resume.searchProfiles.map((profile) => (
                  <Link key={profile.id} href="/profiles" className="rounded-md border border-[var(--line)] p-3 text-sm hover:bg-[var(--soft)]">
                    <div className="font-medium">{profile.title}</div>
                    <div className="mt-1 text-xs text-[var(--muted)]">
                      {profile.isActive ? "активный" : profile.status === "archived" ? "архив" : "неактивный"}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </Card>
        </aside>
      </div>
    </>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return <span className="rounded-md border border-[var(--line)] px-3 py-1 text-xs text-[var(--muted)]">{children}</span>;
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between rounded-md bg-[var(--soft)] px-3 py-2">
      <span>{label}</span>
      <span className="font-semibold text-[var(--foreground)]">{value}</span>
    </div>
  );
}

