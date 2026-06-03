"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, inputClass } from "@/components/ui";
import { vacancyStatusLabels, vacancyStatuses } from "@/lib/vacancy-status";

export function VacancyStatusSelect({ vacancyId, currentStatus }: { vacancyId: string; currentStatus: string }) {
  const router = useRouter();
  const [status, setStatus] = useState(currentStatus);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function save() {
    setBusy(true);
    setMessage("");
    const response = await fetch(`/api/vacancies/${vacancyId}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status })
    });
    const data = await response.json();
    setBusy(false);
    setMessage(response.ok ? "Статус обновлён." : data.message);
    if (response.ok) router.refresh();
  }

  return (
    <div className="grid gap-2">
      <select className={inputClass} value={status} onChange={(event) => setStatus(event.target.value)}>
        {vacancyStatuses.map((item) => (
          <option key={item} value={item}>
            {vacancyStatusLabels[item]}
          </option>
        ))}
      </select>
      <Button onClick={save} disabled={busy || status === currentStatus}>
        {busy ? "Сохраняем..." : "Изменить статус"}
      </Button>
      {message ? <p className="text-xs text-[var(--muted)]">{message}</p> : null}
    </div>
  );
}
