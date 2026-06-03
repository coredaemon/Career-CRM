"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Field, inputClass } from "@/components/ui";

export function AddResumeForm() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [originalText, setOriginalText] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function saveResume() {
    setBusy(true);
    setMessage("");
    const response = await fetch("/api/resumes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, originalText })
    });
    const data = await response.json();
    setBusy(false);
    setMessage(response.ok ? "Резюме добавлено локально." : data.message);
    if (response.ok) {
      setTitle("");
      setOriginalText("");
      router.refresh();
    }
  }

  return (
    <>
      <Card className="grid gap-4">
        <Field label="Название">
          <input className={inputClass} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Например: основное резюме" />
        </Field>
        <Field label="Текст резюме">
          <textarea className={`${inputClass} min-h-72`} value={originalText} onChange={(event) => setOriginalText(event.target.value)} />
        </Field>
        <Button onClick={saveResume} disabled={busy || !title || !originalText}>
          {busy ? "Сохраняем..." : "Добавить резюме"}
        </Button>
      </Card>
      {message ? <p className="mt-5 rounded-md border border-[var(--line)] bg-[var(--panel)] p-3 text-sm">{message}</p> : null}
    </>
  );
}
