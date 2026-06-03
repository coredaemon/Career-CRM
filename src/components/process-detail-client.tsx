"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useProcessPolling } from "@/hooks/use-process-polling";
import { analysisModeLabels, type AnalysisMode } from "@/lib/analysis-mode";
import { Button, Card } from "@/components/ui";

type ProcessLog = { id: string; level: string; message: string; createdAt: string };
type ProcessItem = {
  id: string;
  vacancyId: string | null;
  status: string;
  title: string;
  errorCode?: string | null;
  errorMessage?: string | null;
  durationMs?: number | null;
};

type AiDiagnostics = {
  totalCalls: number;
  retryCount: number;
  invalidJsonCount: number;
  timeoutCount: number;
  durationByRole: Record<string, number>;
  lastCall: {
    provider: string;
    role: string;
    model: string;
    durationMs: number | null;
    createdAt: string;
  } | null;
  coverLettersCreated: number;
};

type NormalizedState = {
  humanStatusLabel: string;
  humanSummary: string;
  displayCurrent: number;
  displayTotal: number;
  progressPercent: number | null;
  elapsedLabel: string;
  etaLabel: string;
  avgSecondsPerItem: number | null;
  canStop: boolean;
  canRetry: boolean;
  canMarkStopped: boolean;
  analysisMode?: AnalysisMode | null;
  status: string;
};

type StatusResponse = {
  ok: boolean;
  state: NormalizedState;
  items: ProcessItem[];
  diagnostics: AiDiagnostics;
  logs: ProcessLog[];
  run: {
    id: string;
    status: string;
    title: string;
    errorMessage?: string | null;
    result: Record<string, unknown> | null;
  };
};

type Initial = {
  id: string;
  status: string;
  title: string;
  logs?: ProcessLog[];
};

export function ProcessDetailClient({ initial }: { initial: Initial }) {
  const router = useRouter();
  const pollingEnabled = initial.status === "running" || initial.status === "queued";
  const { data } = useProcessPolling<StatusResponse>(`/api/processes/${initial.id}`, {
    enabled: pollingEnabled
  });

  const state = data?.state;
  const run = data?.run;
  const logs = pollingEnabled ? (data?.logs ?? []) : (data?.logs?.length ? data.logs : initial.logs ?? []);
  const items = data?.items ?? [];
  const diagnostics = data?.diagnostics;

  const percent = state?.progressPercent ?? 0;

  async function stopProcess() {
    await fetch(`/api/processes/${initial.id}/stop`, { method: "POST" });
    router.refresh();
  }

  async function markStopped() {
    await fetch(`/api/processes/${initial.id}/mark-stopped`, { method: "POST" });
    router.refresh();
  }

  return (
    <div className="grid gap-6">
      <Card>
        <div className="text-sm text-[var(--muted)]">{state?.humanStatusLabel ?? initial.status}</div>
        <div className="mt-2 text-2xl font-semibold">
          {state ? `${state.displayCurrent} / ${state.displayTotal}` : "—"} ({percent}%)
        </div>
        {state?.humanSummary ? <p className="mt-2 text-sm">{state.humanSummary}</p> : null}
        {state?.analysisMode ? (
          <p className="mt-1 text-xs text-[var(--muted)]">Режим: {analysisModeLabels[state.analysisMode]}</p>
        ) : null}
        {state ? (
          <p className="mt-2 text-sm text-[var(--muted)]">
            Идёт {state.elapsedLabel}
            {state.avgSecondsPerItem ? ` · Среднее: ${state.avgSecondsPerItem} сек/вакансия` : ""}
            {state.etaLabel ? ` · ${state.etaLabel}` : ""}
          </p>
        ) : null}
        {run?.errorMessage ? <p className="mt-2 text-sm text-amber-700">{run.errorMessage}</p> : null}
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-[var(--soft)]">
          <div className="h-full bg-[var(--accent)] transition-all" style={{ width: `${percent}%` }} />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {state?.canStop ? (
            <Button onClick={stopProcess}>Остановить процесс</Button>
          ) : null}
          {state?.canMarkStopped ? (
            <button type="button" onClick={markStopped} className="rounded-md border border-[var(--line)] px-4 py-2 text-sm">
              Пометить как остановленный
            </button>
          ) : null}
          {state?.canRetry ? (
            <Link href="/vacancies?status=analysis_error" className="rounded-md border border-[var(--line)] px-4 py-2 text-sm">
              Повторить ошибки
            </Link>
          ) : null}
        </div>
      </Card>

      {diagnostics ? (
        <Card>
          <h2 className="font-semibold">Скорость и диагностика</h2>
          <ul className="mt-3 grid gap-1 text-sm text-[var(--muted)]">
            <li>AI-вызовов: {diagnostics.totalCalls}</li>
            <li>Retries: {diagnostics.retryCount}</li>
            <li>Ошибок JSON: {diagnostics.invalidJsonCount}</li>
            <li>Таймаутов: {diagnostics.timeoutCount}</li>
            <li>Писем создано: {diagnostics.coverLettersCreated}</li>
            {Object.entries(diagnostics.durationByRole).map(([role, ms]) => (
              <li key={role}>
                Время на {role}: {Math.round(ms / 1000)} сек
              </li>
            ))}
            {diagnostics.lastCall ? (
              <li>
                Последний AI-вызов: {diagnostics.lastCall.provider} / {diagnostics.lastCall.role}
                {diagnostics.lastCall.durationMs ? ` / ${Math.round(diagnostics.lastCall.durationMs / 1000)} сек` : ""}
              </li>
            ) : (
              <li>Среднее время на вакансию пока считается…</li>
            )}
          </ul>
        </Card>
      ) : null}

      {items.length > 0 ? (
        <Card>
          <h2 className="font-semibold">Вакансии процесса</h2>
          <div className="mt-3 max-h-64 overflow-auto text-sm">
            {items.map((item) => (
              <div key={item.id} className="mb-2 flex justify-between gap-2 border-b border-[var(--line)] pb-2">
                <span>
                  {item.title}
                  {item.vacancyId ? (
                    <>
                      {" "}
                      <Link href={`/vacancies/${item.vacancyId}`} className="text-xs underline">
                        открыть
                      </Link>
                    </>
                  ) : null}
                </span>
                <span className="text-xs text-[var(--muted)]">{item.status}</span>
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      <Card>
        <h2 className="font-semibold">Лог</h2>
        <div className="mt-3 max-h-96 overflow-auto text-sm leading-6">
          {logs.map((log) => (
            <div key={log.id} className="mb-1">
              <span className="text-xs text-[var(--muted)]">{new Date(log.createdAt).toLocaleTimeString("ru-RU")}</span> ·{" "}
              {log.message}
            </div>
          ))}
        </div>
      </Card>

      {run?.result ? (
        <Card>
          <h2 className="font-semibold">Итог</h2>
          <pre className="mt-3 overflow-auto text-xs">{JSON.stringify(run.result, null, 2)}</pre>
        </Card>
      ) : null}
    </div>
  );
}
