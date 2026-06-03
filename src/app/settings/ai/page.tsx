"use client";

import { useEffect, useState } from "react";
import { Button, Card, Field, PageHeader, inputClass } from "@/components/ui";

export default function AiSettingsPage() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({
    aiProvider: "openai-compatible",
    aiBaseUrl: "",
    aiApiKey: "",
    aiPrimaryModel: "",
    aiFastModel: ""
  });

  useEffect(() => {
    fetch("/api/settings/ai")
      .then((response) => response.json())
      .then((data) =>
        setForm((current) => ({
          ...current,
          aiProvider: data.aiProvider || current.aiProvider,
          aiBaseUrl: data.aiBaseUrl || "",
          aiPrimaryModel: data.aiPrimaryModel || "",
          aiFastModel: data.aiFastModel || ""
        }))
      );
  }, []);

  async function test() {
    setBusy(true);
    setMessage("");
    const response = await fetch("/api/settings/ai/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form)
    });
    const data = await response.json();
    setBusy(false);
    setMessage(data.message);
    if (response.ok) setForm((current) => ({ ...current, aiApiKey: "" }));
  }

  return (
    <>
      <PageHeader title="AI Settings" description="Настройки OpenAI-compatible провайдера хранятся локально. API key вводится для проверки и не отображается после сохранения." />
      <Card className="grid max-w-3xl gap-4">
        <Field label="Provider">
          <select className={inputClass} value={form.aiProvider} onChange={(event) => setForm({ ...form, aiProvider: event.target.value })}>
            <option value="openai-compatible">OpenAI-compatible</option>
            <option value="openai">OpenAI</option>
            <option value="local">Local compatible endpoint</option>
          </select>
        </Field>
        <Field label="Base URL">
          <input className={inputClass} value={form.aiBaseUrl} onChange={(event) => setForm({ ...form, aiBaseUrl: event.target.value })} placeholder="https://api.openai.com/v1" />
        </Field>
        <Field label="API key">
          <input className={inputClass} type="password" value={form.aiApiKey} onChange={(event) => setForm({ ...form, aiApiKey: event.target.value })} placeholder="Введите ключ для проверки" />
        </Field>
        <Field label="Primary model">
          <input className={inputClass} value={form.aiPrimaryModel} onChange={(event) => setForm({ ...form, aiPrimaryModel: event.target.value })} />
        </Field>
        <Field label="Fast model">
          <input className={inputClass} value={form.aiFastModel} onChange={(event) => setForm({ ...form, aiFastModel: event.target.value })} />
        </Field>
        <Button onClick={test} disabled={busy}>{busy ? "Проверяем..." : "Проверить ключ"}</Button>
      </Card>
      {message ? <p className="mt-5 rounded-md border border-[var(--line)] bg-[var(--panel)] p-3 text-sm">{message}</p> : null}
    </>
  );
}
