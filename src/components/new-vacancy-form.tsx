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
  nextActionType: string;
  nextActionAt: string;
  nextActionNote: string;
  testRequired: boolean;
  testStatus: string;
  testLink: string;
  testNotes: string;
};

const nextActionTypes = [
  "проверить ответ",
  "отправить отклик вручную",
  "пройти тест",
  "написать follow-up",
  "подготовиться к собеседованию",
  "заполнить итоги собеседования",
  "принять решение",
  "архивировать"
];

const testStatuses = ["не требуется", "требуется", "не начато", "пройдено", "отправлено", "жду результат", "после теста отказ", "после теста пригласили дальше"];

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
  rawDescription: "",
  nextActionType: "",
  nextActionAt: "",
  nextActionNote: "",
  testRequired: false,
  testStatus: "не требуется",
  testLink: "",
  testNotes: ""
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
      resumeId: form.resumeId || null,
      nextActionAt: form.nextActionAt || null,
      nextActionType: form.nextActionType || null
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
    <Card className="grid gap-5">
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Профиль поиска">
          <select className={inputClass} value={form.searchProfileId} onChange={(event) => update("searchProfileId", event.target.value)}>
            <option value="">Без профиля</option>
            {profiles.map((profile) => (
              <option key={profile.id} value={profile.id}>
                {profile.title}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Резюме">
          <select className={inputClass} value={form.resumeId} onChange={(event) => update("resumeId", event.target.value)}>
            <option value="">Выберите резюме для AI-разбора</option>
            {resumes.map((resume) => (
              <option key={resume.id} value={resume.id}>
                {resume.title}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Источник">
          <select className={inputClass} value={form.source} onChange={(event) => update("source", event.target.value as VacancyFormState["source"])}>
            <option value="manual">ручной ввод</option>
            <option value="hh">hh</option>
            <option value="other">другой источник</option>
          </select>
        </Field>
        <Field label="Ссылка на вакансию">
          <input className={inputClass} value={form.sourceUrl} onChange={(event) => update("sourceUrl", event.target.value)} />
        </Field>
        <Field label="Название">
          <input className={inputClass} value={form.title} onChange={(event) => update("title", event.target.value)} />
        </Field>
        <Field label="Компания">
          <input className={inputClass} value={form.companyName} onChange={(event) => update("companyName", event.target.value)} />
        </Field>
        <Field label="Зарплата">
          <input className={inputClass} value={form.salaryText} onChange={(event) => update("salaryText", event.target.value)} />
        </Field>
        <Field label="Город / регион">
          <input className={inputClass} value={form.location} onChange={(event) => update("location", event.target.value)} />
        </Field>
        <Field label="Формат работы">
          <input className={inputClass} value={form.workFormat} onChange={(event) => update("workFormat", event.target.value)} placeholder="офис, гибрид, удалённо" />
        </Field>
      </div>

      <Field label="Текст вакансии">
        <textarea className={`${inputClass} min-h-80`} value={form.rawDescription} onChange={(event) => update("rawDescription", event.target.value)} />
      </Field>

      <div className="grid gap-4 rounded-md border border-[var(--line)] p-4 md:grid-cols-2">
        <Field label="Следующее действие">
          <select className={inputClass} value={form.nextActionType} onChange={(event) => update("nextActionType", event.target.value)}>
            <option value="">Не задано</option>
            {nextActionTypes.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Дата и время действия">
          <input className={inputClass} type="datetime-local" value={form.nextActionAt} onChange={(event) => update("nextActionAt", event.target.value)} />
        </Field>
        <Field label="Заметка к действию">
          <input className={inputClass} value={form.nextActionNote} onChange={(event) => update("nextActionNote", event.target.value)} />
        </Field>
      </div>

      <div className="grid gap-4 rounded-md border border-[var(--line)] p-4 md:grid-cols-2">
        <label className="flex items-center gap-2 text-sm font-medium">
          <input type="checkbox" checked={form.testRequired} onChange={(event) => update("testRequired", event.target.checked)} />
          Требуется тестирование
        </label>
        <Field label="Статус тестирования">
          <select className={inputClass} value={form.testStatus} onChange={(event) => update("testStatus", event.target.value)}>
            {testStatuses.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Ссылка на тест">
          <input className={inputClass} value={form.testLink} onChange={(event) => update("testLink", event.target.value)} />
        </Field>
        <Field label="Заметки по тестированию">
          <input className={inputClass} value={form.testNotes} onChange={(event) => update("testNotes", event.target.value)} />
        </Field>
      </div>

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
