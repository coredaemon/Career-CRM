import { AiSettingsPanel } from "@/components/ai-settings-panel";
import { PageHeader } from "@/components/ui";

export default function AiSettingsPage() {
  return (
    <>
      <PageHeader
        title="Настройки AI"
        description="Выберите провайдера, проверьте API-ключ и сохраните модели. Технические параметры нужны только для OpenAI-совместимого API."
      />
      <AiSettingsPanel />
    </>
  );
}
