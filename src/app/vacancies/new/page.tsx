import { NewVacancyForm } from "@/components/new-vacancy-form";
import { PageHeader } from "@/components/ui";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function NewVacancyPage() {
  const [profiles, resumes] = await Promise.all([
    prisma.searchProfile.findMany({
      orderBy: { createdAt: "desc" },
      select: { id: true, title: true }
    }),
    prisma.resume.findMany({
      orderBy: { createdAt: "desc" },
      select: { id: true, title: true }
    })
  ]);

  return (
    <>
      <PageHeader title="Новая вакансия" description="Добавьте вакансию вручную, сохраните без AI или сразу получите разбор и сопроводительное письмо." />
      <NewVacancyForm profiles={profiles} resumes={resumes} />
    </>
  );
}
