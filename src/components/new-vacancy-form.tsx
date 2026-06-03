"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Field, inputClass } from "@/components/ui";

type Option = {
  id: string;
  title: string;
};

type VacancyFormState = {
  searchProfileId: string;
  resumeId: string;
  source: "hh" | "manual" | "other";
  sourceUrl: string;
  title: string;
  companyName: string;
  salaryText: string;
  location: string;
  workFormat: string;
  rawDescription: string;
};

const initialState: VacancyFormState = {
  searchProfileId: "",
  resumeId: "",
  source: "manual",
  sourceUrl: "",
  title: "",
  companyName: "",
  salaryText: "",
  location: "",
  workFormat: "",
  rawDescription: ""
};

export function NewVacancyForm({ profiles, resumes }: { profiles: Option[]; resumes: Option[] }) {
  const router = useRouter();
  const [form, setForm] = useState<VacancyFormState>(initialState);
  const [busy, setBusy] = useState<"save" | "ai" | null>(null);
  const [message, setMessage] = useState("");

  function update<K extends keyof VacancyFormState>(key: K, value: VacancyFormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function payload() {
    return {
      ...form,
      searchProfileId: form.searchProfileId || null,
      resumeId: form.resumeId || null
    };
  }

  async function saveWithoutAi() {
    setBusy("save");
    setMessage("");
    const response = await fetch("/api/vacancies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload())
    });
    const data = await response.json();
    setBusy(null);
    if (!response.ok) {
      setMessage(data.message);
      return;
    }
    router.push(`/vacancies/${data.vacancy.id}`);
    router.refresh();
  }

  async function analyzeAndSave() {
    setBusy("ai");
    setMessage("");
    const response = await fetch("/api/vacancies/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload(), mode: "analyze_and_save" })
    });
    const data = await response.json();
    setBusy(null);
    if (!response.ok) {
      setMessage(data.message);
      return;
    }
    router.push(`/vacancies/${data.vacancy.id}`);
    router.refresh();
  }

  return (
    <Card className="grid gap-4">
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="SearchProfile">
          <select className={inputClass} value={form.searchProfileId} onChange={(event) => update("searchProfileId", event.target.value)}>
            <option value="">Без профиля</option>
            {profiles.map((profile) => (
              <option key={profile.id} value={profile.id}>
                {profile.title}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Resume">
          <select className={inputClass} value={form.resumeId} onChange={(event) => update("resumeId", event.target.value)}>
            <option value="">Выберите резюме для AI</option>
            {resumes.map((resume) => (
              <option key={resume.id} value={resume.id}>
                {resume.title}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Источник">
          <select className={inputClass} value={form.source} onChange={(event) => update("source", event.target.value as VacancyFormState["source"])}>
            <option value="manual">manual</option>
            <option value="hh">hh</option>
            <option value="other">other</option>
          </select>
        </Field>
        <Field label="Source URL">
          <input className={inputClass} value={form.sourceUrl} onChange={(event) => update("sourceUrl", event.target.value)} />
        </Field>
        <Field label="Название вакансии">
          <input className={inputClass} value={form.title} onChange={(event) => update("title", event.target.value)} />
        </Field>
        <Field label="Компания">
          <input className={inputClass} value={form.companyName} onChange={(event) => update("companyName", event.target.value)} />
        </Field>
        <Field label="Зарплата">
          <input className={inputClass} value={form.salaryText} onChange={(event) => update("salaryText", event.target.value)} />
        </Field>
        <Field label="Локация">
          <input className={inputClass} value={form.location} onChange={(event) => update("location", event.target.value)} />
        </Field>
        <Field label="Формат работы">
          <input className={inputClass} value={form.workFormat} onChange={(event) => update("workFormat", event.target.value)} placeholder="office / hybrid / remote" />
        </Field>
      </div>
      <Field label="Описание вакансии">
        <textarea className={`${inputClass} min-h-80`} value={form.rawDescription} onChange={(event) => update("rawDescription", event.target.value)} />
      </Field>
      <div className="flex flex-wrap gap-3">
        <Button variant="secondary" onClick={saveWithoutAi} disabled={Boolean(busy) || !form.title}>
          {busy === "save" ? "Сохраняем..." : "Сохранить без AI"}
        </Button>
        <Button onClick={analyzeAndSave} disabled={Boolean(busy) || !form.title || !form.resumeId || form.rawDescription.length < 50}>
          {busy === "ai" ? "AI анализирует..." : "Проанализировать AI"}
        </Button>
      </div>
      {message ? <p className="rounded-md border border-[var(--line)] bg-[var(--soft)] p-3 text-sm">{message}</p> : null}
    </Card>
  );
}
