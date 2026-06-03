"use client";

import { useState } from "react";
import Link from "next/link";
import { Button, Card, Field, inputClass } from "@/components/ui";

type CleanupPreview = {
  type: string;
  label: string;
  affectedVacancies: number;
  affectedSearchRuns: number;
  affectedProcessRuns: number;
  preservedApplications: number;
  preservedCoverLetters: number;
  acceptedLearningObservationsPreserved: number;
  draftLearningObservationsRelated: number;
  statuses: Record<string, number>;
  warnings: string[];
};

const cleanupTypes = [
  { value: "untouched_vacancies", label: "Нетронутые вакансии", description: "Без откликов, писем, пользовательских причин отказа и принятой памяти." },
  { value: "analysis_errors", label: "Ошибки анализа", description: "Вакансии со статусом ошибки AI без писем и откликов." },
  { value: "invalid_sources", label: "Невалидные источники", description: "Служебные или мусорные URL, которые не являются вакансиями." },
  { value: "old_runs", label: "Старые процессы и запуски", description: "Удаляет завершённые/ошибочные запуски, но не вакансии." },
  { value: "full_vacancy_reset", label: "Полная очистка вакансий и процессов", description: "Опасная операция. Резюме, профили, настройки и принятая память сохраняются." }
];

export function DataCleanupPanel() {
  const [type, setType] = useState(cleanupTypes[0].value);
  const [mode, setMode] = useState<"archive" | "delete">("archive");
  const [confirmText, setConfirmText] = useState("");
  const [includeDraftLearningObservations, setIncludeDraftLearningObservations] = useState(false);
  const [preview, setPreview] = useState<CleanupPreview | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState("");

  async function loadPreview() {
    setBusy("preview");
    setMessage("");
    const response = await fetch(`/api/settings/data/cleanup-preview?type=${encodeURIComponent(type)}`);
    const data = await response.json();
    setBusy("");
    if (!response.ok) {
      setMessage(data.message || "Не удалось подготовить preview.");
      return;
    }
    setPreview(data.preview);
  }

  async function apply() {
    setBusy("apply");
    setMessage("");
    const response = await fetch("/api/settings/data/cleanup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, mode, confirmText, includeDraftLearningObservations })
    });
    const data = await response.json();
    setBusy("");
    if (!response.ok) {
      setMessage(data.message || "Не удалось выполнить очистку.");
      return;
    }
    setPreview(data.result);
    setMessage(data.result.message);
  }

  const selected = cleanupTypes.find((item) => item.value === type);
  const fullReset = type === "full_vacancy_reset";
  const oldRuns = type === "old_runs";

  return (
    <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
      <Card className="grid content-start gap-4">
        <div>
          <h2 className="text-xl font-semibold tracking-normal">Безопасная очистка</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
            Сначала посмотрите preview. По умолчанию CareerOS архивирует мусор и не трогает отклики, письма, резюме, профили и принятые правила памяти.
          </p>
        </div>
        <Field label="Что очистить">
          <select
            className={inputClass}
            value={type}
            onChange={(event) => {
              setType(event.target.value);
              setPreview(null);
              setMessage("");
              setMode(event.target.value === "old_runs" || event.target.value === "full_vacancy_reset" ? "delete" : "archive");
            }}
          >
            {cleanupTypes.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </Field>
        <p className="text-sm leading-6 text-[var(--muted)]">{selected?.description}</p>
        {!oldRuns && !fullReset ? (
          <Field label="Режим">
            <select className={inputClass} value={mode} onChange={(event) => setMode(event.target.value as "archive" | "delete")}>
              <option value="archive">Архивировать</option>
              <option value="delete">Удалить физически</option>
            </select>
          </Field>
        ) : null}
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={includeDraftLearningObservations} onChange={(event) => setIncludeDraftLearningObservations(event.target.checked)} />
          Также удалить черновые наблюдения памяти по затронутым вакансиям
        </label>
        {fullReset ? (
          <Field label="Подтверждение">
            <input className={inputClass} value={confirmText} onChange={(event) => setConfirmText(event.target.value)} placeholder="УДАЛИТЬ ВАКАНСИИ" />
          </Field>
        ) : null}
        <div className="flex flex-wrap gap-3">
          <Button variant="secondary" onClick={loadPreview} disabled={Boolean(busy)}>
            {busy === "preview" ? "Считаем..." : "Показать preview"}
          </Button>
          <Button onClick={apply} disabled={Boolean(busy) || !preview || (fullReset && confirmText !== "УДАЛИТЬ ВАКАНСИИ")}>
            {busy === "apply" ? "Выполняем..." : oldRuns ? "Очистить процессы" : fullReset ? "Полностью очистить" : mode === "archive" ? "Архивировать" : "Удалить"}
          </Button>
        </div>
        {message ? <p className="rounded-md border border-[var(--line)] p-3 text-sm">{message}</p> : null}
      </Card>

      <Card>
        <h2 className="text-xl font-semibold tracking-normal">Preview</h2>
        {preview ? (
          <div className="mt-4 grid gap-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <Metric label="Вакансий" value={preview.affectedVacancies} />
              <Metric label="Запусков поиска" value={preview.affectedSearchRuns} />
              <Metric label="Процессов" value={preview.affectedProcessRuns} />
              <Metric label="Откликов сохранится" value={preview.preservedApplications} />
              <Metric label="Писем сохранится" value={preview.preservedCoverLetters} />
              <Metric label="Принятых правил сохранится" value={preview.acceptedLearningObservationsPreserved} />
            </div>
            <div>
              <h3 className="text-sm font-semibold">Статусы вакансий</h3>
              <div className="mt-2 flex flex-wrap gap-2">
                {Object.entries(preview.statuses).length ? (
                  Object.entries(preview.statuses).map(([status, count]) => (
                    <span key={status} className="rounded-md bg-[var(--soft)] px-3 py-1 text-sm text-[var(--muted)]">
                      {status}: {count}
                    </span>
                  ))
                ) : (
                  <span className="text-sm text-[var(--muted)]">Вакансии не затрагиваются.</span>
                )}
              </div>
            </div>
            <div className="grid gap-2 text-sm text-[var(--muted)]">
              {preview.warnings.map((warning) => (
                <p key={warning} className="rounded-md border border-[var(--line)] p-3">
                  {warning}
                </p>
              ))}
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/vacancies" className="rounded-md border border-[var(--line)] px-4 py-2 text-sm hover:bg-[var(--soft)]">
                Открыть вакансии
              </Link>
              <Link href="/memory" className="rounded-md border border-[var(--line)] px-4 py-2 text-sm hover:bg-[var(--soft)]">
                Открыть память AI
              </Link>
              <Link href="/processes" className="rounded-md border border-[var(--line)] px-4 py-2 text-sm hover:bg-[var(--soft)]">
                Открыть процессы
              </Link>
            </div>
          </div>
        ) : (
          <p className="mt-3 text-sm leading-6 text-[var(--muted)]">Выберите тип очистки и нажмите “Показать preview”.</p>
        )}
      </Card>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md bg-[var(--soft)] p-3">
      <div className="text-xs text-[var(--muted)]">{label}</div>
      <div className="mt-1 text-2xl font-semibold tracking-normal">{value}</div>
    </div>
  );
}
