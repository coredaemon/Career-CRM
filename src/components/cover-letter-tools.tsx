"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import {
  validateCoverLetterText,
  warningToForbiddenFragment,
  isManagerial,
  isContractFocused,
  isLitigationFocused,
  type CoverLetterWarning,
  type ValidationContext
} from "@/lib/cover-letter-validator";

type StyleOption = {
  label: string;
  instruction: string;
  /**
   * Optional guard: returns true when the accent is relevant for the vacancy.
   * If the guard returns false a soft warning is shown and the neutral style is used.
   */
  isRelevant?: (ctx: ValidationContext) => boolean;
};

const styleOptions: StyleOption[] = [
  { label: "Спокойное (базовое)", instruction: "спокойный деловой стиль, без пафоса" },
  { label: "Короткое", instruction: "3–4 предложения, максимально коротко" },
  {
    label: "Акцент на судебную работу",
    instruction: "больше акцент на судебную работу",
    isRelevant: (ctx) => isLitigationFocused(ctx)
  },
  {
    label: "Акцент на договорную работу",
    instruction: "больше акцент на договорную работу",
    isRelevant: (ctx) => isContractFocused(ctx)
  },
  {
    label: "Акцент на управление",
    instruction: "больше акцент на управление",
    isRelevant: (ctx) => isManagerial(ctx)
  }
];

export function CoverLetterTools({
  vacancyId,
  resumeId,
  currentText,
  disabled,
  validationContext
}: {
  vacancyId: string;
  resumeId?: string;
  currentText?: string;
  disabled?: boolean;
  validationContext?: ValidationContext;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [editText, setEditText] = useState(currentText ?? "");
  const [editDirty, setEditDirty] = useState(false);
  const [saveBusy, setSaveBusy] = useState(false);
  const [warningsHidden, setWarningsHidden] = useState(false);

  const warnings = useMemo<CoverLetterWarning[]>(
    () => (editText ? validateCoverLetterText(editText, validationContext) : []),
    [editText, validationContext]
  );

  async function regenerate(instruction: string, forbiddenFragments?: string[]) {
    if (!resumeId) {
      setMessage("Для перегенерации нужно резюме, связанное с письмом.");
      return;
    }
    setBusy(instruction);
    setMessage("");
    setWarningsHidden(false);
    const response = await fetch(`/api/vacancies/${vacancyId}/cover-letter`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resumeId, instruction, ...(forbiddenFragments?.length ? { forbiddenFragments } : {}) })
    });
    const data = await response.json();
    setBusy("");
    if (response.ok) {
      const autoNote = data.autoRegenerated ? " (письмо было авто-перегенерировано по критичным предупреждениям)" : "";
      setMessage(`Новое письмо создано.${autoNote}`);
      setEditText(data.coverLetter?.text ?? "");
      setEditDirty(false);
      router.refresh();
    } else {
      setMessage(data.message ?? "Не удалось перегенерировать.");
    }
  }

  function handleAccentClick(option: StyleOption) {
    const ctx = validationContext ?? {};
    if (option.isRelevant && !option.isRelevant(ctx)) {
      setMessage(
        `Выбранный акцент «${option.label}» слабо связан с этой вакансией. Письмо сохранено в нейтральном стиле.`
      );
      void regenerate("спокойный деловой стиль, без пафоса");
      return;
    }
    void regenerate(option.instruction);
  }

  function handleRegenerateWithoutFragments() {
    const fragments = warnings.map(warningToForbiddenFragment);
    void regenerate("спокойный деловой стиль, без пафоса", fragments);
  }

  async function saveEdits() {
    setSaveBusy(true);
    setMessage("");
    const response = await fetch(`/api/vacancies/${vacancyId}/cover-letter`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: editText })
    });
    const data = await response.json();
    setSaveBusy(false);
    if (response.ok) {
      setMessage("Правки сохранены.");
      setEditDirty(false);
      router.refresh();
    } else {
      setMessage(data.message ?? "Не удалось сохранить.");
    }
  }

  function handleTextChange(value: string) {
    setEditText(value);
    setEditDirty(value !== (currentText ?? ""));
    setWarningsHidden(false);
  }

  const hasCritical = warnings.some((w) => w.level === "critical");

  return (
    <div className="grid gap-4">
      {currentText !== undefined ? (
        <div className="grid gap-2">
          <textarea
            className="w-full rounded-md border border-[var(--line)] bg-[var(--bg)] p-3 text-sm leading-6 focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
            rows={8}
            value={editText}
            onChange={(e) => handleTextChange(e.target.value)}
            disabled={disabled || saveBusy}
          />
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => void saveEdits()} disabled={disabled || saveBusy || !editDirty}>
              {saveBusy ? "Сохраняем..." : "Сохранить правки"}
            </Button>
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard.writeText(editText);
                setMessage("Скопировано.");
              }}
              disabled={!editText}
              className="rounded-md border border-[var(--line)] px-4 py-2 text-sm hover:bg-[var(--soft)] disabled:opacity-50"
            >
              Скопировать
            </button>
            {editDirty ? (
              <button
                type="button"
                onClick={() => {
                  setEditText(currentText ?? "");
                  setEditDirty(false);
                }}
                className="rounded-md border border-[var(--line)] px-4 py-2 text-sm hover:bg-[var(--soft)]"
              >
                Вернуть AI-версию
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {!warningsHidden && warnings.length > 0 ? (
        <div className={`rounded-lg border p-4 ${hasCritical ? "border-red-300 bg-red-50 dark:bg-red-950/30" : "border-amber-300 bg-amber-50 dark:bg-amber-950/30"}`}>
          <div className={`mb-2 text-sm font-medium ${hasCritical ? "text-red-800 dark:text-red-200" : "text-amber-800 dark:text-amber-200"}`}>
            {hasCritical
              ? "Письмо содержит критичные нерелевантные фрагменты:"
              : "Письмо может содержать нерелевантные или нежелательные фрагменты:"}
          </div>
          <ul className="grid gap-1.5">
            {warnings.map((w) => (
              <li
                key={w.code}
                className={`flex items-start gap-2 text-sm ${hasCritical ? "text-red-800 dark:text-red-200" : "text-amber-800 dark:text-amber-200"}`}
              >
                <span className="mt-0.5 flex-none">{w.level === "critical" ? "⚠" : "•"}</span>
                <span>{w.message}</span>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleRegenerateWithoutFragments}
              disabled={disabled || Boolean(busy)}
              className="rounded-md border border-[var(--line)] bg-white px-3 py-1.5 text-xs font-medium hover:bg-[var(--soft)] disabled:opacity-50 dark:bg-transparent"
            >
              {busy ? "Генерируем..." : "Перегенерировать без этих фрагментов"}
            </button>
            <button
              type="button"
              onClick={() => setWarningsHidden(true)}
              className="rounded-md border border-[var(--line)] px-3 py-1.5 text-xs text-[var(--muted)] hover:bg-[var(--soft)]"
            >
              Скрыть предупреждение
            </button>
          </div>
        </div>
      ) : null}

      <div>
        <p className="mb-2 text-xs font-medium text-[var(--muted)]">Перегенерировать в стиле:</p>
        <div className="flex flex-wrap gap-2">
          {styleOptions.map((option) => (
            <Button
              key={option.instruction}
              variant="secondary"
              onClick={() => handleAccentClick(option)}
              disabled={disabled || Boolean(busy)}
            >
              {busy === option.instruction ? "Готовим..." : option.label}
            </Button>
          ))}
          <Button
            onClick={() => void regenerate("спокойный деловой стиль, без пафоса")}
            disabled={disabled || Boolean(busy)}
          >
            {busy === "спокойный деловой стиль, без пафоса" && !styleOptions.some((o) => o.instruction === busy)
              ? "Готовим..."
              : "Перегенерировать"}
          </Button>
        </div>
      </div>

      {message ? <p className="text-sm text-[var(--muted)]">{message}</p> : null}
    </div>
  );
}
