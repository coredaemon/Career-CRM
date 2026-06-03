"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";

export function CreateCoverLetterButton({
  vacancyId,
  resumeId,
  label = "Создать сопроводительное письмо",
  compact = false,
  disabled
}: {
  vacancyId: string;
  resumeId?: string | null;
  label?: string;
  compact?: boolean;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function createLetter() {
    if (!resumeId) {
      setError("Не выбрано резюме. Привяжите профиль поиска к вакансии.");
      return;
    }
    setBusy(true);
    setError("");
    const response = await fetch(`/api/vacancies/${vacancyId}/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "letters_only", resumeId })
    });
    const data = await response.json();
    setBusy(false);
    if (!response.ok) {
      setError(data.message || "Не удалось создать письмо.");
      return;
    }
    router.refresh();
  }

  return (
    <div className={compact ? "inline-flex flex-wrap items-center gap-2" : "grid gap-3"}>
      <Button onClick={() => void createLetter()} disabled={disabled || busy || !resumeId}>
        {busy ? "Создаём письмо…" : label}
      </Button>
      {error ? (
        <div className={compact ? "w-full" : ""}>
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          <div className="mt-2">
            <Button variant="secondary" onClick={() => void createLetter()} disabled={busy}>
              Повторить
            </Button>
          </div>
        </div>
      ) : null}
      {!resumeId && !error ? (
        <p className="text-xs text-[var(--muted)]">Нужен профиль поиска с резюме для создания письма.</p>
      ) : null}
    </div>
  );
}
