"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui";

export const SKIP_QUICK_REASONS = [
  "Не мой профиль",
  "Нет опыта в этой специализации",
  "Мало денег",
  "Зарплата не указана",
  "Мутная компания",
  "Продажи / холодные звонки",
  "Слишком младшая позиция",
  "Слишком высокая / нереалистичная должность",
  "Непонятные обязанности",
  "Слишком много обязанностей",
  "Неподходящий график / формат",
  "Тестирование до общения",
  "Не хочу объяснять"
] as const;

type Props = {
  vacancyId: string;
  vacancyTitle: string;
  onClose: () => void;
  onSkipped: () => void;
};

export function SkipVacancyModal({ vacancyId, vacancyTitle, onClose, onSkipped }: Props) {
  const [selectedReasons, setSelectedReasons] = useState<string[]>([]);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  function toggleReason(reason: string) {
    setSelectedReasons((prev) =>
      prev.includes(reason) ? prev.filter((r) => r !== reason) : [...prev, reason]
    );
  }

  async function submit(withReason: boolean) {
    setBusy(true);
    setError("");
    const response = await fetch(`/api/vacancies/${vacancyId}/skip`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        quickReasons: withReason ? selectedReasons : [],
        comment: withReason ? comment.trim() : ""
      })
    });
    const data = await response.json();
    setBusy(false);
    if (!response.ok) {
      setError(data.message ?? "Не удалось скрыть вакансию.");
      return;
    }
    onSkipped();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="flex w-full max-w-md flex-col rounded-xl border border-[var(--line)] bg-[var(--background)] shadow-xl"
        style={{ maxHeight: "min(90vh, 640px)" }}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-6 pb-4">
          <div className="min-w-0 pr-4">
            <h2 className="text-lg font-semibold">Почему вакансия не подходит?</h2>
            <p className="mt-1 line-clamp-1 text-sm text-[var(--muted)]">{vacancyTitle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            className="flex-none rounded-md p-1 text-[var(--muted)] hover:bg-[var(--soft)] hover:text-[var(--foreground)]"
          >
            ✕
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 pb-4">
          <div className="flex flex-wrap gap-2">
            {SKIP_QUICK_REASONS.map((reason) => (
              <button
                key={reason}
                type="button"
                onClick={() => toggleReason(reason)}
                className={`focus-ring rounded-full border px-3 py-1 text-xs transition ${
                  selectedReasons.includes(reason)
                    ? "border-[var(--accent)] bg-[var(--soft)] text-[var(--foreground)]"
                    : "border-[var(--line)] text-[var(--muted)] hover:border-[var(--accent)]"
                }`}
              >
                {reason}
              </button>
            ))}
          </div>

          <div className="mt-4">
            <label className="block text-sm text-[var(--muted)]">Комментарий своими словами</label>
            <textarea
              className="mt-1 w-full rounded-md border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]"
              rows={3}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Необязательно..."
            />
          </div>

          {error ? <p className="mt-3 text-sm text-red-500">{error}</p> : null}
        </div>

        {/* Sticky footer */}
        <div className="flex flex-wrap gap-3 border-t border-[var(--line)] p-4">
          <Button onClick={() => submit(true)} disabled={busy}>
            {busy ? "Сохраняем..." : "Сохранить и скрыть"}
          </Button>
          <Button variant="secondary" onClick={() => submit(false)} disabled={busy}>
            Только скрыть
          </Button>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Отмена
          </Button>
        </div>
      </div>
    </div>
  );
}
