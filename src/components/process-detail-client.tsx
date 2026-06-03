"use client";

import { useProcessPolling } from "@/hooks/use-process-polling";
import { processStatusLabel } from "@/lib/process-status";
import { Card } from "@/components/ui";

type ProcessLog = { id: string; level: string; message: string; createdAt: string };

type Initial = {
  id: string;
  status: string;
  title: string;
  description?: string | null;
  progressCurrent: number;
  progressTotal: number;
  currentStep?: string | null;
  startedAt: string;
  finishedAt?: string;
  errorMessage?: string | null;
  result: Record<string, unknown> | null;
  logs: ProcessLog[];
};

type StatusResponse = {
  ok: boolean;
  run: Initial & { statusLabel?: string; updatedAt?: string };
  logs: ProcessLog[];
};

export function ProcessDetailClient({ initial }: { initial: Initial }) {
  const { data } = useProcessPolling<StatusResponse>(`/api/processes/${initial.id}`, {
    enabled: initial.status === "running" || initial.status === "queued"
  });

  const run = data?.run || initial;
  const logs = data?.logs || initial.logs;
  const percent = run.progressTotal > 0 ? Math.round((run.progressCurrent / run.progressTotal) * 100) : 0;

  return (
    <div className="grid gap-6">
      <Card>
        <div className="text-sm text-[var(--muted)]">
          {data?.run?.statusLabel || processStatusLabel(run.status)}
        </div>
        <div className="mt-2 text-2xl font-semibold">
          {run.progressCurrent} / {run.progressTotal} ({percent}%)
        </div>
        {run.currentStep ? <p className="mt-2 text-sm">{run.currentStep}</p> : null}
        {run.errorMessage ? <p className="mt-2 text-sm text-amber-700">{run.errorMessage}</p> : null}
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-[var(--soft)]">
          <div className="h-full bg-[var(--accent)]" style={{ width: `${percent}%` }} />
        </div>
      </Card>
      <Card>
        <h2 className="font-semibold">Лог</h2>
        <div className="mt-3 max-h-96 overflow-auto text-sm leading-6">
          {logs.map((log) => (
            <div key={log.id} className="mb-1">
              <span className="text-xs text-[var(--muted)]">{new Date(log.createdAt).toLocaleTimeString("ru-RU")}</span> · {log.message}
            </div>
          ))}
        </div>
      </Card>
      {run.result ? (
        <Card>
          <h2 className="font-semibold">Итог</h2>
          <pre className="mt-3 overflow-auto text-xs">{JSON.stringify(run.result, null, 2)}</pre>
        </Card>
      ) : null}
    </div>
  );
}
