import { DataCleanupPanel } from "@/components/data-cleanup-panel";
import { PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

export default function DataSettingsPage() {
  return (
    <>
      <PageHeader
        title="Данные"
        description="Безопасная очистка тестовых вакансий, ошибок анализа и старых процессов. Резюме, профили, настройки и принятые правила памяти не удаляются без отдельного явного решения."
      />
      <DataCleanupPanel />
    </>
  );
}

