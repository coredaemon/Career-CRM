"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { useProcessPolling } from "@/hooks/use-process-polling";
import { Button } from "@/components/ui";

type ProcessStatus = {
  ok: boolean;
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

export function BulkAiAnalyzeButton({
  label = "Проанализировать непроанализированные",
  retryErrorsOnly = false
}: {
  label?: string;
  retryErrorsOnly?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [processRunId, setProcessRunId] = useState("");
  const [message, setMessage] = useState("");

  const handleTerminal = useCallback(
    (payload: ProcessStatus) => {
      const result = payload.run?.result;
      setBusy(false);
      setMessage(
        result
          ? `AI-анализ завершён: ${result.analyzed ?? 0}, пропущено: ${result.skipped ?? 0}, ошибок: ${result.errorCount ?? 0}, писем: ${result.coverLetters ?? 0}.`
          : payload.run?.statusLabel || "Процесс завершён."
      );
      router.refresh();
    },
    [router]
  );

  const { data: processStatus } = useProcessPolling<ProcessStatus>(
    processRunId ? `/api/processes/${processRunId}` : null,
    { enabled: Boolean(processRunId), onTerminal: handleTerminal }
  );

  const status = processStatus?.run?.status;
  const isActive = busy && (status === "running" || status === "queued" || !status);

  async function analyze() {
    setBusy(true);
    setMessage("");
    setProcessRunId("");

    const response = await fetch("/api/vacancies/analyze-bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ limit: 20, retryErrorsOnly })
    });
    const data = await response.json();

    if (!response.ok) {
      setBusy(false);
      setMessage(data.message);
      return;
    }

    setProcessRunId(data.processRunId);
    setMessage(`Запущен AI-анализ: ${data.total} вакансий.`);
  }

  async function stopProcess() {
    if (!processRunId) return;
    await fetch(`/api/processes/${processRunId}/stop`, { method: "POST" });
    setMessage("Остановка запрошена. Завершим после текущей вакансии.");
  }

  const progress = processStatus?.run;

  return (
    <div className="grid gap-2">
      <Button onClick={analyze} disabled={busy}>
        {busy ? "AI анализирует..." : label}
      </Button>
      {isActive && progress ? (
        <p className="text-xs text-[var(--muted)]">
          {progress.statusLabel}: {progress.progressCurrent} из {progress.progressTotal}
          {processRunId ? (
            <>
              {" "}
              ·{" "}
              <Link href={`/processes/${processRunId}`} className="underline">
                Открыть процесс
              </Link>
            </>
          ) : null}
        </p>
      ) : null}
      {busy && processRunId ? (
        <button type="button" onClick={stopProcess} className="text-left text-xs text-[var(--muted)] underline">
          Остановить после текущей
        </button>
      ) : null}
      {message ? <p className="text-xs text-[var(--muted)]">{message}</p> : null}
    </div>
  );
}
