import { EmptyState, PageHeader } from "@/components/ui";

export default function CompaniesPage() {
  return (
    <>
      <PageHeader title="Companies" description="Список компаний пока пустой." />
      <EmptyState title="Компаний пока нет" description="Проверка работодателей и карточки компаний появятся после базового CRM-ядра." />
    </>
  );
}
