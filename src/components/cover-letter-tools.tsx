"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";

const toneOptions = [
  "короче",
  "увереннее",
  "мягче",
  "больше акцент на управление",
  "больше акцент на судебную работу",
  "больше акцент на договорную работу"
];

export function CoverLetterTools({ vacancyId, resumeId, disabled }: { vacancyId: string; resumeId?: string; disabled?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");

  async function regenerate(instruction: string) {
    if (!resumeId) {
      setMessage("Для перегенерации нужно резюме, связанное с письмом.");
      return;
    }

    setBusy(instruction);
    setMessage("");
    const response = await fetch(`/api/vacancies/${vacancyId}/cover-letter`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resumeId, instruction })
    });
    const data = await response.json();
    setBusy("");
    setMessage(response.ok ? "Новое письмо создано." : data.message);
    if (response.ok) router.refresh();
  }

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap gap-2">
        {toneOptions.map((tone) => (
          <Button key={tone} variant="secondary" onClick={() => regenerate(tone)} disabled={disabled || Boolean(busy)}>
            {busy === tone ? "Готовим..." : tone}
          </Button>
        ))}
      </div>
      <Button onClick={() => regenerate("перегенерировать базово")} disabled={disabled || Boolean(busy)}>
        {busy === "перегенерировать базово" ? "Готовим..." : "Перегенерировать"}
      </Button>
      {message ? <p className="text-sm text-[var(--muted)]">{message}</p> : null}
    </div>
  );
}
