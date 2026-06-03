"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Field, inputClass } from "@/components/ui";

type ResumeEditorProps = {
  resume: {
    id: string;
    title: string;
    originalText: string;
    aiSummary: string | null;
    confirmedFacts: string | null;
  };
};

export function ResumeDetailEditor({ resume }: ResumeEditorProps) {
  const router = useRouter();
  const [title, setTitle] = useState(resume.title);
  const [originalText, setOriginalText] = useState(resume.originalText);
  const [aiSummary, setAiSummary] = useState(resume.aiSummary || "");
  const [confirmedFacts, setConfirmedFacts] = useState(resume.confirmedFacts || "");
  const [dirtyText, setDirtyText] = useState(false);
  const [busy, setBusy] = useState<"save" | "analyze" | null>(null);
  const [message, setMessage] = useState("");

  const parsedSummary = useMemo(() => parseSummary(aiSummary), [aiSummary]);

  async function save() {
    setBusy("save");
    setMessage("");
    const response = await fetch(`/api/resumes/${resume.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, originalText, aiSummary: aiSummary || null, confirmedFacts: confirmedFacts || null })
    });
    const data = await response.json();
    setBusy(null);
    setMessage(response.ok ? "Резюме сохранено." : data.message);
    if (response.ok) {
      setDirtyText(false);
      router.refresh();
    }
  }

  async function analyze() {
    setBusy("analyze");
    setMessage("");
    const response = await fetch("/api/resumes/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resumeId: resume.id, resumeText: originalText, save: true })
    });
    const data = await response.json();
    setBusy(null);
    if (!response.ok) {
      setMessage(data.message);
      return;
    }
    setAiSummary(JSON.stringify(data.analysis, null, 2));
    setMessage("AI-анализ обновлён.");
    router.refresh();
  }

  return (
    <div className="grid gap-6">
      <Card className="grid gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-xl font-semibold tracking-normal">Основной текст резюме</h2>
          {dirtyText ? (
            <span className="rounded-md border border-amber-300 bg-amber-50 px-3 py-1 text-sm text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
              Резюме изменено. Рекомендуется повторно выполнить AI-анализ.
            </span>
          ) : null}
        </div>
        <Field label="Название">
          <input className={inputClass} value={title} onChange={(event) => setTitle(event.target.value)} />
        </Field>
        <Field label="Текст резюме">
          <textarea
            className={`${inputClass} min-h-96`}
            value={originalText}
            onChange={(event) => {
              setOriginalText(event.target.value);
              setDirtyText(true);
            }}
          />
        </Field>
        <div className="flex flex-wrap gap-3">
          <Button onClick={save} disabled={Boolean(busy) || !title || originalText.trim().length < 50}>
            {busy === "save" ? "Сохраняем..." : "Сохранить изменения"}
          </Button>
          <Button variant="secondary" onClick={analyze} disabled={Boolean(busy) || originalText.trim().length < 200}>
            {busy === "analyze" ? "AI анализирует..." : "Повторно проанализировать резюме"}
          </Button>
        </div>
      </Card>

      <Card className="grid gap-4">
        <h2 className="text-xl font-semibold tracking-normal">Подтверждённые факты для писем</h2>
        <p className="text-sm leading-6 text-[var(--muted)]">
          Здесь можно перечислить только факты, которые AI имеет право использовать в сопроводительных письмах. Не добавляйте то, чего нет в резюме или вашем подтверждении.
        </p>
        <Field label="Факты">
          <textarea
            className={`${inputClass} min-h-44`}
            value={confirmedFacts}
            onChange={(event) => setConfirmedFacts(event.target.value)}
            placeholder="Например: договорная работа; претензионная работа; сопровождение судебных споров; управление юридическими процессами."
          />
        </Field>
        <Button onClick={save} disabled={Boolean(busy)}>
          Сохранить факты
        </Button>
      </Card>

      <Card className="grid gap-4">
        <h2 className="text-xl font-semibold tracking-normal">AI-анализ резюме</h2>
        {parsedSummary ? (
          <div className="grid gap-4">
            <SummaryBlock title="Краткий профиль" value={parsedSummary.profile_summary || parsedSummary.profile_title} />
            <SummaryList title="Сильные стороны" items={parsedSummary.strengths} />
            <SummaryList title="Возможные роли" items={parsedSummary.target_roles || parsedSummary.possible_directions} />
            <SummaryList title="Поисковые запросы" items={parsedSummary.search_queries} />
            <SummaryList title="Стоп-слова" items={parsedSummary.stop_words} />
            <SummaryBlock title="Стиль сопроводительных" value={parsedSummary.cover_letter_tone} />
          </div>
        ) : (
          <p className="text-sm text-[var(--muted)]">AI-анализ ещё не выполнен или сохранён обычным текстом.</p>
        )}
        <Field label="Редактировать AI-анализ вручную">
          <textarea className={`${inputClass} min-h-80 font-mono`} value={aiSummary} onChange={(event) => setAiSummary(event.target.value)} />
        </Field>
        <Button onClick={save} disabled={Boolean(busy)}>
          Сохранить AI-анализ
        </Button>
      </Card>

      {message ? <p className="rounded-md border border-[var(--line)] bg-[var(--panel)] p-3 text-sm">{message}</p> : null}
    </div>
  );
}

function parseSummary(text: string) {
  if (!text) return null;
  try {
    return JSON.parse(text) as Record<string, string | string[]>;
  } catch {
    return null;
  }
}

function SummaryBlock({ title, value }: { title: string; value?: string | string[] }) {
  if (!value || Array.isArray(value)) return null;
  return (
    <div>
      <h3 className="text-sm font-semibold">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{value}</p>
    </div>
  );
}

function SummaryList({ title, items }: { title: string; items?: string | string[] }) {
  if (!Array.isArray(items) || items.length === 0) return null;
  return (
    <div>
      <h3 className="text-sm font-semibold">{title}</h3>
      <ul className="mt-2 grid gap-2 text-sm leading-6 text-[var(--muted)]">
        {items.map((item) => (
          <li key={item}>• {item}</li>
        ))}
      </ul>
    </div>
  );
}
