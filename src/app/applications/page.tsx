import { EmptyState, PageHeader } from "@/components/ui";

export default function ApplicationsPage() {
  return (
    <>
      <PageHeader title="Applications" description="CRM-воронка откликов подготовлена, но автоматической отправки нет." />
      <EmptyState title="Откликов пока нет" description="CareerOS MVP-1 не отправляет отклики и не автоматизирует внешние сайты." />
    </>
  );
}
