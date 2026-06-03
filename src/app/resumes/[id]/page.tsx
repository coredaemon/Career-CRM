import Link from "next/link";
import { notFound } from "next/navigation";
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
        orderBy: { createdAt: "desc" }
      }
    }
  });

  if (!resume) notFound();

  return (
    <>
      <PageHeader
        title={resume.title}
        description={`${resume.sourceType === "file" ? "PDF / файл" : "Текст"}${resume.sourceFileName ? ` · ${resume.sourceFileName}` : ""}`}
      />
      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <ResumeDetailEditor
          resume={{
            id: resume.id,
            title: resume.title,
            originalText: resume.originalText,
            aiSummary: resume.aiSummary,
            confirmedFacts: resume.confirmedFacts
          }}
        />
        <aside className="grid content-start gap-4">
          <Card>
            <h2 className="text-lg font-semibold tracking-normal">Связанные профили поиска</h2>
            {resume.searchProfiles.length === 0 ? (
              <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
                Профилей пока нет. Создание нового профиля из обновлённого резюме лучше делать через подтверждение AI-предложений.
              </p>
            ) : (
              <div className="mt-4 grid gap-3">
                {resume.searchProfiles.map((profile) => (
                  <Link key={profile.id} href="/profiles" className="rounded-md border border-[var(--line)] p-3 text-sm hover:bg-[var(--soft)]">
                    <div className="font-medium">{profile.title}</div>
                    <div className="mt-1 text-xs text-[var(--muted)]">{profile.status}</div>
                  </Link>
                ))}
              </div>
            )}
          </Card>
          <Card>
            <h2 className="text-lg font-semibold tracking-normal">Обновление профиля</h2>
            <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
              Следующий шаг: создать отдельный экран предложений AI для обновления профиля без молчаливого затирания текущих настроек.
            </p>
          </Card>
        </aside>
      </div>
    </>
  );
}
