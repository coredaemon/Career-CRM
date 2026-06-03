import { EmptyState, PageHeader } from "@/components/ui";

export default function VacanciesPage() {
  return (
    <>
      <PageHeader title="Vacancies" description="Доска вакансий подготовлена для следующего этапа." />
      <EmptyState title="Поиск вакансий будет добавлен на следующем этапе" description="MVP-1 не парсит hh и не собирает вакансии автоматически." />
    </>
  );
}
