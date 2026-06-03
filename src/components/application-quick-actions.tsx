"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { CopyButton } from "@/components/copy-button";
import { Button } from "@/components/ui";

export function ApplicationQuickActions({
  applicationId,
  vacancyId,
  followUpText
}: {
  applicationId: string;
  vacancyId: string;
  followUpText?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  async function run(action: "responded" | "rejected" | "no_response" | "follow_up" | "archived") {
    setBusy(action);
    await fetch(`/api/applications/${applicationId}/action`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action })
    });
    setBusy(null);
    router.refresh();
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Link href={`/vacancies/${vacancyId}`} className="rounded-md border border-[var(--line)] px-4 py-2 text-sm hover:bg-[var(--soft)]">
        Открыть вакансию
      </Link>
      <Button variant="secondary" onClick={() => run("responded")} disabled={Boolean(busy)}>
        Ответили
      </Button>
      <Button variant="secondary" onClick={() => run("rejected")} disabled={Boolean(busy)}>
        Отказ
      </Button>
      <Button variant="secondary" onClick={() => run("no_response")} disabled={Boolean(busy)}>
        Нет ответа
      </Button>
      <Button variant="secondary" onClick={() => run("follow_up")} disabled={Boolean(busy)}>
        Написать follow-up
      </Button>
      {followUpText ? <CopyButton text={followUpText} label="Скопировать follow-up" /> : null}
      <Button variant="secondary" onClick={() => run("archived")} disabled={Boolean(busy)}>
        В архив
      </Button>
    </div>
  );
}
