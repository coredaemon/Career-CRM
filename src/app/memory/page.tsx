import { MemoryObservationsPanel } from "@/components/memory-observations-panel";
import { PageHeader } from "@/components/ui";

export default function MemoryPage() {
  return (
    <>
      <PageHeader
        title="Память AI"
        description="Черновые наблюдения из ваших решений по вакансиям. Принятые правила применяются при анализе новых вакансий."
      />
      <MemoryObservationsPanel />
    </>
  );
}
