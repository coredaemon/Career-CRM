import { prisma } from "@/lib/prisma";
import { fromJsonText } from "@/lib/json";
import { Card, EmptyState, PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function ProfilesPage() {
  const profiles = await prisma.searchProfile.findMany({
    orderBy: { createdAt: "desc" },
    include: { resume: true }
  });

  return (
    <>
      <PageHeader title="Профили поиска" description="Профили создаются только после анализа резюме и подтверждения пользователем." />
      {profiles.length === 0 ? (
        <EmptyState title="Профилей пока нет" description="Пройдите первичную настройку, чтобы создать первый профиль из текста резюме." />
      ) : (
        <div className="grid gap-4">
          {profiles.map((profile) => {
            const roles = fromJsonText<string[]>(profile.targetRolesJson, []);
            const queries = fromJsonText<string[]>(profile.searchQueriesJson, []);
            return (
              <Card key={profile.id}>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h2 className="text-xl font-semibold tracking-normal">{profile.title}</h2>
                    <p className="mt-1 text-sm text-[var(--muted)]">Из резюме: {profile.resume.title}</p>
                  </div>
                  <span className="rounded-md border border-[var(--line)] px-3 py-1 text-sm">{profile.status === "active" ? "активен" : profile.status}</span>
                </div>
                <p className="mt-4 text-sm leading-6 text-[var(--muted)]">{profile.summary}</p>
                <Tags title="Подходящие роли" items={roles} />
                <Tags title="Поисковые запросы" items={queries} />
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}

function Tags({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <div className="mt-4">
      <h3 className="text-sm font-semibold">{title}</h3>
      <div className="mt-2 flex flex-wrap gap-2">
        {items.map((item) => (
          <span key={item} className="rounded-md bg-[var(--soft)] px-3 py-1 text-sm text-[var(--muted)]">
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}
