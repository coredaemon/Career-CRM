import { EmptyState, PageHeader } from "@/components/ui";

export default function ApplicationsPage() {
  return (
    <>
      <PageHeader title="Отклики" description="CRM-воронка откликов подготовлена. Автоматической отправки нет." />
      <EmptyState title="Откликов пока нет" description="CareerOS не отправляет отклики автоматически. Когда вы отправите отклик вручную, его можно будет учитывать здесь." />
    </>
  );
}
