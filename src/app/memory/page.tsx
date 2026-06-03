import { Card, PageHeader } from "@/components/ui";

export default function MemoryPage() {
  const stages = ["сырые события", "наблюдения", "предложенные правила", "подтверждённые правила"];

  return (
    <>
      <PageHeader title="Память AI" description="Раздел подготовлен для будущей подтверждаемой памяти AI." />
      <Card>
        <div className="grid gap-3 md:grid-cols-4">
          {stages.map((stage, index) => (
            <div key={stage} className="rounded-md border border-[var(--line)] p-4">
              <div className="text-sm text-[var(--muted)]">Шаг {index + 1}</div>
              <div className="mt-2 font-semibold">{stage}</div>
            </div>
          ))}
        </div>
        <p className="mt-5 text-sm leading-6 text-[var(--muted)]">
          В этой версии здесь только структура. Позже CareerOS сможет превращать события поиска в наблюдения, предлагать правила и применять
          только правила, подтверждённые пользователем.
        </p>
      </Card>
    </>
  );
}
