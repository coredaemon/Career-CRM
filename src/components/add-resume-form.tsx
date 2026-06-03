"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Field, inputClass } from "@/components/ui";

export function AddResumeForm() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [originalText, setOriginalText] = useState("");
  const [sourceFileName, setSourceFileName] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState<"save" | "pdf" | null>(null);

  async function parsePdf(file: File) {
    setBusy("pdf");
    setMessage("");
    const formData = new FormData();
    formData.append("file", file);
    const response = await fetch("/api/resumes/pdf", {
      method: "POST",
      body: formData
    });
    const data = await response.json();
    setBusy(null);
    if (!response.ok) {
      setMessage(data.message || "Не удалось извлечь текст из PDF.");
      return;
    }
    setSourceFileName(file.name);
    setOriginalText(data.text);
    if (!title) setTitle(file.name.replace(/\.pdf$/i, ""));
    setMessage("Текст извлечён из PDF. Проверьте его и поправьте перед сохранением.");
  }

  async function saveResume() {
    setBusy("save");
    setMessage("");
    const response = await fetch("/api/resumes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        originalText,
        sourceType: sourceFileName ? "file" : "text",
        sourceFileName: sourceFileName || null
      })
    });
    const data = await response.json();
    setBusy(null);
    setMessage(response.ok ? "Резюме добавлено локально." : data.message);
    if (response.ok) {
      router.push(`/resumes/${data.resume.id}`);
      router.refresh();
    }
  }

  return (
    <>
      <Card className="grid gap-4">
        <div>
          <h2 className="text-xl font-semibold tracking-normal">Добавить резюме</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
            Вставьте текст вручную или загрузите PDF с текстовым слоем. OCR на этом этапе не выполняется.
          </p>
        </div>
        <Field label="PDF-файл">
          <input
            className={inputClass}
            type="file"
            accept="application/pdf,.pdf"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void parsePdf(file);
            }}
          />
        </Field>
        {sourceFileName ? <p className="text-xs text-[var(--muted)]">Источник: {sourceFileName}</p> : null}
        <Field label="Название">
          <input className={inputClass} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Например: основное резюме" />
        </Field>
        <Field label="Текст резюме" hint="Перед сохранением можно вручную поправить извлечённый текст.">
          <textarea className={`${inputClass} min-h-72`} value={originalText} onChange={(event) => setOriginalText(event.target.value)} />
        </Field>
        <Button onClick={saveResume} disabled={Boolean(busy) || !title || originalText.trim().length < 50}>
          {busy === "save" ? "Сохраняем..." : "Сохранить резюме"}
        </Button>
      </Card>
      {busy === "pdf" ? <p className="mt-5 rounded-md border border-[var(--line)] bg-[var(--panel)] p-3 text-sm">Извлекаем текст из PDF...</p> : null}
      {message ? <p className="mt-5 rounded-md border border-[var(--line)] bg-[var(--panel)] p-3 text-sm">{message}</p> : null}
    </>
  );
}
