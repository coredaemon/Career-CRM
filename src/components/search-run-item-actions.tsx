"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { isSearchRunItemJunk } from "@/lib/search-run-stats";
import { Button } from "@/components/ui";

export function SearchRunItemActions({
  item
}: {
  item: {
    id: string;
    status: string;
    sourceUrl: string;
    errorCode?: string | null;
    errorMessage?: string | null;
    vacancy?: { id: string } | null;
  };
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const junk = isSearchRunItemJunk(item.status, Boolean(item.vacancy));
  const vacancyId = item.vacancy?.id;

  async function archive() {
    if (!vacancyId) return;
    setBusy(true);
    await fetch(`/api/vacancies/${vacancyId}/action`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "archived" })
    });
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {item.sourceUrl ? (
        <a
          href={item.sourceUrl}
          target="_blank"
          rel="noreferrer"
          className="rounded-md border border-[var(--line)] px-3 py-1.5 text-xs hover:bg-[var(--soft)]"
        >
          Открыть источник
        </a>
      ) : null}
      {!junk && vacancyId ? (
        <Link
          href={`/vacancies/${vacancyId}`}
          className="rounded-md border border-[var(--line)] px-3 py-1.5 text-xs hover:bg-[var(--soft)]"
        >
          Открыть вакансию
        </Link>
      ) : null}
      {vacancyId ? (
        <Button variant="secondary" onClick={archive} disabled={busy}>
          {busy ? "…" : "В архив"}
        </Button>
      ) : null}
      <details className="text-xs">
        <summary className="cursor-pointer text-[var(--muted)]">Технические детали</summary>
        <p className="mt-1 text-[var(--muted)]">status: {item.status}</p>
        {item.errorCode ? <p className="text-[var(--muted)]">code: {item.errorCode}</p> : null}
        {item.errorMessage ? <p className="text-[var(--muted)]">{item.errorMessage}</p> : null}
      </details>
    </div>
  );
}
