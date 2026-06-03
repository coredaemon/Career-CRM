"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";

export function CompaniesBackfillButton({ count }: { count: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function run() {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/companies/backfill", { method: "POST" });
      const data = await response.json();
      if (response.ok) {
        setMessage(`Создано компаний: ${data.created}, связано вакансий: ${data.linked}.`);
        router.refresh();
      } else {
        setMessage(data.message ?? "Не удалось создать компании.");
      }
    } catch {
      setMessage("Не удалось создать компании.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-2">
      <Button onClick={run} disabled={busy}>
        {busy ? "Создаём компании..." : `Создать компании из вакансий (${count})`}
      </Button>
      {message ? <p className="text-sm text-[var(--muted)]">{message}</p> : null}
    </div>
  );
}
