import { EmptyState, PageHeader } from "@/components/ui";

export default function CompaniesPage() {
  return (
    <>
      <PageHeader title="Компании" description="Список компаний пока пустой." />
      <EmptyState title="Компаний пока нет" description="Карточки компаний создаются при добавлении вакансий вручную." />
    </>
  );
}
