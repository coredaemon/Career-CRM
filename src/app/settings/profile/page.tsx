import { SalarySettingsPanel } from "@/components/salary-settings-panel";
import { PageHeader } from "@/components/ui";

export default function ProfileSettingsPage() {
  return (
    <>
      <PageHeader
        title="Профиль и ожидания"
        description="Зарплатные ожидания используются AI для анализа вакансий и сопроводительных писем."
      />
      <SalarySettingsPanel />
    </>
  );
}
