"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui";

type JunkCandidate = {
  id: string;
  title: string;
  sourceUrl: string | null;
  companyName: string | null;
  reason: string;
};

export function JunkVacancyActions() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [candidates, setCandidates] = useState<JunkCandidate[]>([]);
  const [message, setMessage] = useState("");

  async function scan() {
    setBusy(true);
    setMessage("");
    const response = await fetch("/api/vacancies/mark-junk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "scan" })
    });
    const data = await response.json();
    setBusy(false);
    if (!response.ok) {
      setMessage(data.message || "Не удалось найти мусорные вакансии.");
      return;
    }
    setCandidates(data.candidates || []);
    setMessage(data.count ? `Найдено мусорных записей: ${data.count}.` : "Мусорные записи не найдены.");
  }

  async function mark() {
    setBusy(true);
    setMessage("");
    const response = await fetch("/api/vacancies/mark-junk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "mark",
        vacancyIds: candidates.map((item) => item.id)
      })
    });
    const data = await response.json();
    setBusy(false);
    if (!response.ok) {
      setMessage(data.message || "Не удалось пометить записи.");
      return;
    }
    setCandidates([]);
    setMessage(`Помечено как невалидные: ${data.updated ?? 0}.`);
    router.refresh();
  }

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={scan} disabled={busy}>
          {busy ? "Ищем..." : "Найти мусорные вакансии"}
        </Button>
        {candidates.length > 0 ? (
          <Button onClick={mark} disabled={busy}>
            Пометить как невалидные ({candidates.length})
          </Button>
        ) : null}
      </div>
      {message ? <p className="text-xs text-[var(--muted)]">{message}</p> : null}
      {candidates.length > 0 ? (
        <ul className="grid gap-2 text-sm">
          {candidates.slice(0, 5).map((item) => (
            <li key={item.id} className="rounded-md border border-[var(--line)] p-3">
              <div className="font-medium">{item.title}</div>
              <div className="text-xs text-[var(--muted)]">{item.companyName || "Компания не указана"}</div>
              <div className="mt-1 text-xs text-[var(--muted)]">{item.reason}</div>
            </li>
          ))}
          {candidates.length > 5 ? (
            <li className="text-xs text-[var(--muted)]">…и ещё {candidates.length - 5}</li>
          ) : null}
        </ul>
      ) : null}
    </div>
  );
}
