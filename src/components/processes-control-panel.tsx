"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Card } from "@/components/ui";

type ProcessCard = {
  id: string;
  kind: "search" | "process";
  title: string;
  state: {
    humanStatusLabel: string;
    humanSummary: string;
    displayCurrent: number;
    displayTotal: number;
    progressPercent: number | null;
    elapsedLabel: string;
    etaLabel: string;
    canStop: boolean;
    canMarkStopped: boolean;
    href: string;
    status: string;
  };
};

export function ProcessesControlPanel(props: {
  activeCount: number;
  staleCount: number;
  errorCount: number;
  searchRuns: ProcessCard[];
  processRuns: ProcessCard[];
}) {
  const router = useRouter();
  const [message, setMessage] = useState("");

  async function bulkAction(action: string) {
    const response = await fetch("/api/processes/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action })
    });
    const data = await response.json();
    setMessage(data.ok ? "Готово." : data.message || "Ошибка");
    router.refresh();
  }

  return (
    <Card className="mb-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="text-sm">
          <p>
            Активных: <strong>{props.activeCount}</strong> · Зависших: <strong>{props.staleCount}</strong> · Ошибок:{" "}
            <strong>{props.errorCount}</strong>
          </p>
          {message ? <p className="mt-1 text-xs text-[var(--muted)]">{message}</p> : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => bulkAction("stop_ai")}>Остановить все AI</Button>
          <Button onClick={() => bulkAction("stop_search")}>Остановить все поиски</Button>
          <button
            type="button"
            onClick={() => bulkAction("mark_stale_stopped")}
            className="rounded-md border border-[var(--line)] px-4 py-2 text-sm"
          >
            Пометить зависшие
          </button>
          <button
            type="button"
            onClick={() => bulkAction("hide_completed")}
            className="rounded-md border border-[var(--line)] px-4 py-2 text-sm"
          >
            Скрыть завершённые
          </button>
          <button type="button" onClick={() => router.refresh()} className="rounded-md border border-[var(--line)] px-4 py-2 text-sm">
            Обновить
          </button>
        </div>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        {[...props.processRuns, ...props.searchRuns].map((card) => (
          <div key={`${card.kind}-${card.id}`} className="rounded-md border border-[var(--line)] p-3 text-sm">
            <div className="flex justify-between gap-2">
              <span className="font-medium">{card.title}</span>
              <span className="text-xs">{card.state.humanStatusLabel}</span>
            </div>
            <p className="mt-1 text-xs text-[var(--muted)]">{card.state.humanSummary}</p>
            <p className="mt-1 text-xs">
              {card.state.displayCurrent}/{card.state.displayTotal} · {card.state.elapsedLabel}
              {card.state.etaLabel ? ` · ${card.state.etaLabel}` : ""}
            </p>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--soft)]">
              <div className="h-full bg-[var(--accent)]" style={{ width: `${card.state.progressPercent ?? 0}%` }} />
            </div>
            <div className="mt-2 flex gap-2 text-xs">
              <Link href={card.state.href} className="underline">
                Открыть
              </Link>
              {card.state.canStop && card.kind === "process" ? (
                <button
                  type="button"
                  className="underline"
                  onClick={async () => {
                    await fetch(`/api/processes/${card.id}/stop`, { method: "POST" });
                    router.refresh();
                  }}
                >
                  Остановить
                </button>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
