import { ProfileManager } from "@/components/profile-manager";
import { EmptyState, LinkButton, PageHeader } from "@/components/ui";
import { fromJsonText } from "@/lib/json";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function ProfilesPage({ searchParams }: { searchParams: Promise<{ resumeId?: string }> }) {
  const params = await searchParams;
  const [profiles, resumes] = await Promise.all([
    prisma.searchProfile.findMany({
      orderBy: [{ isActive: "desc" }, { status: "asc" }, { updatedAt: "desc" }],
      include: { resume: true }
    }),
    prisma.resume.findMany({
      where: { isArchived: false },
      orderBy: [{ isActive: "desc" }, { updatedAt: "desc" }],
      select: { id: true, title: true, aiSummary: true, aiSummaryStale: true, isActive: true }
    })
  ]);

  return (
    <>
      <PageHeader
        title="Профили поиска"
        description="Создавайте и редактируйте профили из любого резюме. Активный профиль первым появляется на странице поиска вакансий."
      />
      {resumes.length === 0 ? (
        <EmptyState
          title="Сначала добавьте резюме"
          description="Профиль поиска создаётся только из резюме и только после вашего подтверждения."
          actions={
            <div className="mt-5">
              <LinkButton href="/resumes">Добавить резюме</LinkButton>
            </div>
          }
        />
      ) : (
        <ProfileManager
          defaultResumeId={params.resumeId}
          resumes={resumes.map((resume) => ({
            id: resume.id,
            title: resume.title,
            aiSummary: resume.aiSummary,
            aiSummaryStale: resume.aiSummaryStale,
            isActive: resume.isActive
          }))}
          profiles={profiles.map((profile) => ({
            id: profile.id,
            resumeId: profile.resumeId,
            resumeTitle: profile.resume.title,
            title: profile.title,
            summary: profile.summary,
            targetRoles: fromJsonText<string[]>(profile.targetRolesJson, []),
            searchQueries: fromJsonText<string[]>(profile.searchQueriesJson, []),
            positiveSignals: fromJsonText<string[]>(profile.positiveSignalsJson, []),
            negativeSignals: fromJsonText<string[]>(profile.negativeSignalsJson, []),
            stopWords: fromJsonText<string[]>(profile.stopWordsJson, []),
            status: profile.status,
            isActive: profile.isActive,
            archivedAt: profile.archivedAt?.toISOString() ?? null,
            createdAt: profile.createdAt.toISOString(),
            updatedAt: profile.updatedAt.toISOString()
          }))}
        />
      )}
    </>
  );
}

