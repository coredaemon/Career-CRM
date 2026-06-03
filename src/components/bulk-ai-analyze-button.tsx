"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { type AnalysisMode, analysisModeLabels } from "@/lib/analysis-mode";
import { useProcessPolling } from "@/hooks/use-process-polling";
import { Button } from "@/components/ui";

type NormalizedState = {
  id: string;
  humanSummary: string;
  displayCurrent: number;
  displayTotal: number;
  humanStatusLabel: string;
  href: string;
};

type ProcessStatus = {
  ok: boolean;
  state?: NormalizedState;
  run: {
    id: string;
    status: string;
    statusLabel: string;
    progressCurrent: number;
    progressTotal: number;
    currentStep?: string | null;
    result?: {
      analyzed?: number;
      skipped?: number;
      errorCount?: number;
      coverLetters?: number;
    } | null;
  };
};

type ActiveResponse = {
  ok: boolean;
  activeVacancyAnalysis?: NormalizedState | null;
};

export function BulkAiAnalyzeButton({
  label = "Проанализировать непроанализированные",
  retryErrorsOnly = false,
  defaultMode = "fast" as AnalysisMode,
  lettersOnlyDirect = false
}: {
  label?: string;
  retryErrorsOnly?: boolean;
  defaultMode?: AnalysisMode;
  lettersOnlyDirect?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [processRunId, setProcessRunId] = useState("");
  const [message, setMessage] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [mode, setMode] = useState<AnalysisMode>(defaultMode);
  const [blocking, setBlocking] = useState<NormalizedState | null>(null);
  const [confirmFull, setConfirmFull] = useState(false);

  useEffect(() => {
    fetch("/api/processes/active")
      .then((r) => r.json())
      .then((data: ActiveResponse) => {
        if (data.ok && data.activeVacancyAnalysis) {
          setBlocking(data.activeVacancyAnalysis);
          if (data.activeVacancyAnalysis.id) setProcessRunId(data.activeVacancyAnalysis.id);
        }
      })
      .catch(() => undefined);
  }, []);

  const handleTerminal = useCallback(
    (payload: ProcessStatus) => {
      const result = payload.run?.result;
      setBusy(false);
      setBlocking(null);
      setMessage(
        result
          ? `AI-анализ завершён: ${result.analyzed ?? 0}, пропущено: ${result.skipped ?? 0}, ошибок: ${result.errorCount ?? 0}, писем: ${result.coverLetters ?? 0}.`
          : payload.state?.humanStatusLabel || payload.run?.statusLabel || "Процесс завершён."
      );
      router.refresh();
    },
    [router]
  );

  const { data: processStatus } = useProcessPolling<ProcessStatus>(
    processRunId ? `/api/processes/${processRunId}` : null,
    { enabled: Boolean(processRunId), onTerminal: handleTerminal }
  );

  const state = processStatus?.state;
  const status = processStatus?.run?.status ?? (blocking ? "running" : undefined);
  const isActive = Boolean(blocking) || (busy && (status === "running" || status === "queued" || status === "stopping" || !status));
  const display = state || blocking;

  async function analyze(selectedMode: AnalysisMode) {
    setShowModal(false);
    setBusy(true);
    setMessage("");

    const response = await fetch("/api/vacancies/analyze-bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ limit: 20, retryErrorsOnly, analysisMode: selectedMode })
    });
    const data = await response.json();

    if (response.status === 409 && data.activeProcessRunId) {
      setBusy(false);
      setProcessRunId(data.activeProcessRunId);
      setBlocking(data.state ?? null);
      setMessage(data.message || "AI-анализ уже выполняется.");
      return;
    }

    if (!response.ok) {
      setBusy(false);
      setMessage(data.message);
      return;
    }

    setProcessRunId(data.processRunId);
    setMessage(`Запущен AI-анализ (${analysisModeLabels[selectedMode]}): ${data.total} вакансий.`);
  }

  async function stopProcess() {
    const id = processRunId || blocking?.id;
    if (!id) return;
    await fetch(`/api/processes/${id}/stop`, { method: "POST" });
    setMessage("Остановка запрошена. Завершим после текущей вакансии.");
  }

  function onPrimaryClick() {
    if (retryErrorsOnly) {
      void analyze("fast");
      return;
    }
    if (lettersOnlyDirect) {
      void analyze("letters_only");
      return;
    }
    setConfirmFull(false);
    setShowModal(true);
  }

  function onLaunchClick() {
    if (mode === "full" && !confirmFull) {
      setConfirmFull(true);
      return;
    }
    void analyze(mode);
  }

  return (
    <div className="grid gap-2">
      <Button onClick={onPrimaryClick} disabled={isActive || Boolean(blocking)}>
        {isActive ? "AI анализирует..." : label}
      </Button>

      {blocking && !busy ? (
        <p className="text-xs text-[var(--muted)]">
          {blocking.humanSummary}
          {" · "}
          <Link href={blocking.href} className="underline">
            Открыть процесс
          </Link>
          {" · "}
          <button type="button" onClick={stopProcess} className="underline">
            Остановить
          </button>
        </p>
      ) : null}

      {isActive && display ? (
        <p className="text-xs text-[var(--muted)]">
          {display.humanSummary || `${display.displayCurrent} из ${display.displayTotal}`}
          {(processRunId || display.id) ? (
            <>
              {" "}
              ·{" "}
              <Link href={`/processes/${processRunId || display.id}`} className="underline">
                Открыть процесс
              </Link>
            </>
          ) : null}
        </p>
      ) : null}

      {isActive && (processRunId || blocking?.id) ? (
        <button type="button" onClick={stopProcess} className="text-left text-xs text-[var(--muted)] underline">
          Остановить после текущей вакансии
        </button>
      ) : null}

      {message ? <p className="text-xs text-[var(--muted)]">{message}</p> : null}

      {showModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-lg border border-[var(--line)] bg-[var(--surface)] p-5 shadow-lg">
            <h3 className="text-lg font-semibold">Режим AI-анализа</h3>
            <p className="mt-1 text-sm text-[var(--muted)]">По умолчанию — быстрый анализ (score без писем). Письма создавайте отдельно для рекомендованных.</p>
            <div className="mt-4 grid gap-2 text-sm">
              {(["fast", "full", "letters_only"] as AnalysisMode[]).map((item) => (
                <label key={item} className="flex cursor-pointer gap-2 rounded-md border border-[var(--line)] p-3">
                  <input type="radio" name="analysisMode" checked={mode === item} onChange={() => { setMode(item); setConfirmFull(false); }} />
                  <span>
                    <span className="font-medium">
                      {item === "letters_only" ? "Создать письма для рекомендованных" : analysisModeLabels[item]}
                    </span>
                    {item === "fast" ? (
                      <span className="mt-1 block text-xs text-[var(--muted)]">Рекомендуется для массового прогона: только score и фильтры, без писем.</span>
                    ) : null}
                    {item === "full" ? (
                      <span className="mt-1 block text-xs text-amber-700 dark:text-amber-300">
                        Полный анализ дольше и дороже: кроме score он может запускать проверку и создавать сопроводительные письма для рекомендованных. Лучше использовать его только для небольшого набора вакансий.
                      </span>
                    ) : null}
                    {item === "letters_only" ? (
                      <span className="mt-1 block text-xs text-[var(--muted)]">Только writer для вакансий AI рекомендует / готово к отклику без письма.</span>
                    ) : null}
                  </span>
                </label>
              ))}
            </div>
            {confirmFull ? (
              <p className="mt-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
                Полный анализ на 20+ вакансий может занять много времени и токенов. Подтвердите запуск или выберите «Быстрый анализ».
              </p>
            ) : null}
            <div className="mt-4 flex gap-2">
              <Button onClick={onLaunchClick}>{confirmFull ? "Подтвердить полный анализ" : "Запустить"}</Button>
              <button type="button" className="text-sm underline" onClick={() => { setShowModal(false); setConfirmFull(false); }}>
                Отмена
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
