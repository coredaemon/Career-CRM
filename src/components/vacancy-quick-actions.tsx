"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";

export function VacancyQuickActions({
  vacancyId,
  sourceUrl,
  hideApply = false
}: {
  vacancyId: string;
  sourceUrl?: string | null;
  hideApply?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  async function run(action: "applied" | "skipped" | "archived" | "check_later") {
    setBusy(action);
    await fetch(`/api/vacancies/${vacancyId}/action`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action })
    });
    setBusy(null);
    router.refresh();
  }

  return (
    <div className="flex flex-wrap gap-2">
      {sourceUrl ? (
        <a href={sourceUrl} target="_blank" rel="noreferrer" className="rounded-md border border-[var(--line)] px-4 py-2 text-sm hover:bg-[var(--soft)]">
          {hideApply ? "Открыть источник" : "Открыть на hh"}
        </a>
      ) : null}
      {!hideApply ? (
        <Button onClick={() => run("applied")} disabled={Boolean(busy)}>
          {busy === "applied" ? "Отмечаем..." : "Отклик отправлен"}
        </Button>
      ) : null}
      <Button variant="secondary" onClick={() => run("check_later")} disabled={Boolean(busy)}>
        Проверить позже
      </Button>
      <Button variant="secondary" onClick={() => run("skipped")} disabled={Boolean(busy)}>
        Пропустить
      </Button>
      <Button variant="secondary" onClick={() => run("archived")} disabled={Boolean(busy)}>
        В архив
      </Button>
    </div>
  );
}
