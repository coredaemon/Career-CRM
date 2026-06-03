"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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

const steps = ["AI Setup", "Резюме", "AI-анализ", "Предложения", "Подтверждение"];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [ai, setAi] = useState({
    aiProvider: "openai-compatible",
    aiBaseUrl: "",
    aiApiKey: "",
    aiPrimaryModel: "",
    aiFastModel: ""
  });
  const [resumeTitle, setResumeTitle] = useState("Первое резюме");
  const [resumeText, setResumeText] = useState("");
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [profileTitle, setProfileTitle] = useState("");
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [selectedQueries, setSelectedQueries] = useState<string[]>([]);

  async function testAi() {
    setBusy(true);
    setMessage("");
    const response = await fetch("/api/settings/ai/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(ai)
    });
    const data = await response.json();
    setBusy(false);
    setMessage(data.message);
    if (response.ok) setStep(1);
  }

  async function analyzeResume() {
    setBusy(true);
    setMessage("");
    const response = await fetch("/api/resumes/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        resumeText,
        aiApiKey: ai.aiApiKey,
        aiBaseUrl: ai.aiBaseUrl,
        aiPrimaryModel: ai.aiPrimaryModel
      })
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
      <PageHeader title="Onboarding" description="Пять шагов: AI, резюме, анализ, предложения и подтверждение первого профиля." />
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
        <Card className="grid max-w-3xl gap-4">
          <Field label="Provider">
            <select className={inputClass} value={ai.aiProvider} onChange={(event) => setAi({ ...ai, aiProvider: event.target.value })}>
              <option value="openai-compatible">OpenAI-compatible</option>
              <option value="openai">OpenAI</option>
              <option value="local">Local compatible endpoint</option>
            </select>
          </Field>
          <Field label="Base URL">
            <input className={inputClass} value={ai.aiBaseUrl} onChange={(event) => setAi({ ...ai, aiBaseUrl: event.target.value })} placeholder="https://api.openai.com/v1" />
          </Field>
          <Field label="API key" hint="Ключ используется для проверки и анализа, но не показывается открытым текстом после сохранения.">
            <input className={inputClass} type="password" value={ai.aiApiKey} onChange={(event) => setAi({ ...ai, aiApiKey: event.target.value })} />
          </Field>
          <Field label="Primary model">
            <input className={inputClass} value={ai.aiPrimaryModel} onChange={(event) => setAi({ ...ai, aiPrimaryModel: event.target.value })} placeholder="gpt-4.1" />
          </Field>
          <Field label="Fast model">
            <input className={inputClass} value={ai.aiFastModel} onChange={(event) => setAi({ ...ai, aiFastModel: event.target.value })} placeholder="gpt-4.1-mini" />
          </Field>
          <Button onClick={testAi} disabled={busy}>{busy ? "Проверяем..." : "Проверить ключ"}</Button>
        </Card>
      ) : null}

      {step === 1 ? (
        <Card className="grid gap-4">
          <Field label="Название резюме">
            <input className={inputClass} value={resumeTitle} onChange={(event) => setResumeTitle(event.target.value)} />
          </Field>
          <Field label="Текст резюме">
            <textarea className={`${inputClass} min-h-80`} value={resumeText} onChange={(event) => setResumeText(event.target.value)} placeholder="Вставьте текст резюме без загрузки PDF/DOCX." />
          </Field>
          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => setStep(0)}>Назад</Button>
            <Button onClick={() => setStep(2)} disabled={resumeText.trim().length < 200}>Дальше</Button>
          </div>
        </Card>
      ) : null}

      {step === 2 ? (
        <Card className="max-w-3xl">
          <h2 className="text-xl font-semibold tracking-normal">AI-анализ резюме</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
            Анализ строится только по вставленному тексту. Предустановленных направлений поиска в CareerOS нет.
          </p>
          <div className="mt-5 flex gap-3">
            <Button variant="secondary" onClick={() => setStep(1)}>Назад</Button>
            <Button onClick={analyzeResume} disabled={busy}>{busy ? "Анализируем..." : "Проанализировать резюме"}</Button>
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
            <Section title="Стоп-слова" items={analysis.stop_words} />
            <Section title="Нежелательные сигналы" items={analysis.negative_signals} />
            <Section title="Предупреждения" items={analysis.warnings} />
          </Card>
          <Card className="grid content-start gap-4">
            <Field label="Title профиля">
              <input className={inputClass} value={profileTitle} onChange={(event) => setProfileTitle(event.target.value)} />
            </Field>
            <Checklist title="Target roles" items={analysis.target_roles} selected={selectedRoles} onToggle={(item) => toggle(item, selectedRoles, setSelectedRoles)} />
            <Checklist title="Search queries" items={analysis.search_queries} selected={selectedQueries} onToggle={(item) => toggle(item, selectedQueries, setSelectedQueries)} />
            <div className="flex gap-3">
              <Button variant="secondary" onClick={() => setStep(2)}>Назад</Button>
              <Button onClick={complete} disabled={busy || !profileTitle}>{busy ? "Сохраняем..." : "Сохранить профиль"}</Button>
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
          <span key={item} className="rounded-md border border-[var(--line)] px-3 py-1 text-sm text-[var(--muted)]">{item}</span>
        ))}
      </div>
    </div>
  );
}

function Checklist({ title, items, selected, onToggle }: { title: string; items: string[]; selected: string[]; onToggle: (item: string) => void }) {
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
