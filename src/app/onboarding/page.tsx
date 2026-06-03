"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AiSettingsPanel } from "@/components/ai-settings-panel";
import { Button, Card, Field, PageHeader, inputClass } from "@/components/ui";

type Analysis = {
  profile_title: string;
  profile_summary: string;
  strengths: string[];
  possible_directions: string[];
  target_roles: string[];
  search_queries: string[];
  positive_signals: string[];
  negative_signals: string[];
  stop_words: string[];
  cover_letter_tone: string;
  warnings: string[];
};

const steps = ["AI", "Резюме", "Анализ", "Предложения", "Подтверждение"];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [aiSaved, setAiSaved] = useState(false);
  const [resumeTitle, setResumeTitle] = useState("Первое резюме");
  const [resumeText, setResumeText] = useState("");
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [profileTitle, setProfileTitle] = useState("");
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [selectedQueries, setSelectedQueries] = useState<string[]>([]);

  async function analyzeResume() {
    setBusy(true);
    setMessage("");
    const response = await fetch("/api/resumes/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resumeText })
    });
    const data = await response.json();
    setBusy(false);
    if (!response.ok) {
      setMessage(data.message);
      return;
    }
    setAnalysis(data.analysis);
    setProfileTitle(data.analysis.profile_title);
    setSelectedRoles(data.analysis.target_roles);
    setSelectedQueries(data.analysis.search_queries);
    setStep(3);
  }

  async function complete() {
    if (!analysis) return;
    setBusy(true);
    setMessage("");
    const response = await fetch("/api/onboarding/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        resumeTitle,
        resumeText,
        analysis,
        selectedTargetRoles: selectedRoles,
        selectedSearchQueries: selectedQueries,
        profileTitle
      })
    });
    const data = await response.json();
    setBusy(false);
    if (!response.ok) {
      setMessage(data.message);
      return;
    }
    router.push("/");
    router.refresh();
  }

  function toggle(value: string, list: string[], setter: (next: string[]) => void) {
    setter(list.includes(value) ? list.filter((item) => item !== value) : [...list, value]);
  }

  return (
    <>
      <PageHeader
        title="Первичная настройка"
        description="Сначала настроим AI, затем загрузим резюме, проанализируем его и создадим первый профиль поиска."
      />
      <div className="mb-6 grid gap-2 sm:grid-cols-5">
        {steps.map((label, index) => (
          <div
            key={label}
            className={`rounded-md border px-3 py-2 text-sm ${
              index <= step ? "border-[var(--accent)] bg-[var(--soft)]" : "border-[var(--line)]"
            }`}
          >
            {index + 1}. {label}
          </div>
        ))}
      </div>

      {step === 0 ? (
        <div className="grid gap-5">
          <AiSettingsPanel compact onSaved={() => setAiSaved(true)} />
          <div className="flex gap-3">
            <Button onClick={() => setStep(1)} disabled={!aiSaved}>
              Далее
            </Button>
          </div>
        </div>
      ) : null}

      {step === 1 ? (
        <Card className="grid gap-4">
          <Field label="Название резюме">
            <input className={inputClass} value={resumeTitle} onChange={(event) => setResumeTitle(event.target.value)} />
          </Field>
          <Field label="Текст резюме">
            <textarea
              className={`${inputClass} min-h-80`}
              value={resumeText}
              onChange={(event) => setResumeText(event.target.value)}
              placeholder="Вставьте текст резюме. PDF/DOCX загрузку добавим позже."
            />
          </Field>
          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => setStep(0)}>
              Назад
            </Button>
            <Button onClick={() => setStep(2)} disabled={resumeText.trim().length < 200}>
              Далее
            </Button>
          </div>
        </Card>
      ) : null}

      {step === 2 ? (
        <Card className="max-w-3xl">
          <h2 className="text-xl font-semibold tracking-normal">Анализ резюме</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
            CareerOS строит профиль поиска только по тексту вашего резюме. В системе нет заранее вшитых направлений поиска.
          </p>
          <div className="mt-5 flex gap-3">
            <Button variant="secondary" onClick={() => setStep(1)}>
              Назад
            </Button>
            <Button onClick={analyzeResume} disabled={busy}>
              {busy ? "Анализируем..." : "Проанализировать резюме"}
            </Button>
          </div>
        </Card>
      ) : null}

      {step >= 3 && analysis ? (
        <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
          <Card>
            <h2 className="text-xl font-semibold tracking-normal">{analysis.profile_title}</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{analysis.profile_summary}</p>
            <Section title="Сильные стороны" items={analysis.strengths} />
            <Section title="Предложенные направления" items={analysis.possible_directions} />
            <Section title="Названия вакансий" items={analysis.target_roles} />
            <Section title="Поисковые запросы" items={analysis.search_queries} />
            <Section title="Стоп-слова" items={analysis.stop_words} />
            <Section title="Нежелательные типы вакансий" items={analysis.negative_signals} />
            <Section title="Предупреждения" items={analysis.warnings} />
          </Card>
          <Card className="grid content-start gap-4">
            <Field label="Название профиля">
              <input className={inputClass} value={profileTitle} onChange={(event) => setProfileTitle(event.target.value)} />
            </Field>
            <Checklist title="Подходящие роли" items={analysis.target_roles} selected={selectedRoles} onToggle={(item) => toggle(item, selectedRoles, setSelectedRoles)} />
            <Checklist title="Поисковые запросы" items={analysis.search_queries} selected={selectedQueries} onToggle={(item) => toggle(item, selectedQueries, setSelectedQueries)} />
            <div className="flex gap-3">
              <Button variant="secondary" onClick={() => setStep(2)}>
                Назад
              </Button>
              <Button onClick={complete} disabled={busy || !profileTitle}>
                {busy ? "Создаём..." : "Создать профиль поиска"}
              </Button>
            </div>
          </Card>
        </div>
      ) : null}

      {message ? <p className="mt-5 rounded-md border border-[var(--line)] bg-[var(--panel)] p-3 text-sm">{message}</p> : null}
    </>
  );
}

function Section({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <div className="mt-5">
      <h3 className="text-sm font-semibold">{title}</h3>
      <div className="mt-2 flex flex-wrap gap-2">
        {items.map((item) => (
          <span key={item} className="rounded-md border border-[var(--line)] px-3 py-1 text-sm text-[var(--muted)]">
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}

function Checklist({
  title,
  items,
  selected,
  onToggle
}: {
  title: string;
  items: string[];
  selected: string[];
  onToggle: (item: string) => void;
}) {
  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold">{title}</h3>
      <div className="grid gap-2">
        {items.map((item) => (
          <label key={item} className="flex items-start gap-2 text-sm">
            <input type="checkbox" checked={selected.includes(item)} onChange={() => onToggle(item)} className="mt-1" />
            <span>{item}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
