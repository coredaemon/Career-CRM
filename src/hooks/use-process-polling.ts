"use client";

import { useEffect, useRef, useState } from "react";

export function useProcessPolling<T>(
  url: string | null,
  options?: {
    enabled?: boolean;
    intervalMs?: number;
    onTerminal?: (data: T) => void;
  }
) {
  const shouldPoll = Boolean(url) && (options?.enabled ?? true);
  const intervalMs = options?.intervalMs ?? 1500;
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const onTerminalRef = useRef(options?.onTerminal);

  useEffect(() => {
    onTerminalRef.current = options?.onTerminal;
  }, [options?.onTerminal]);

  useEffect(() => {
    if (!shouldPoll || !url) return;

    let cancelled = false;

    async function poll() {
      try {
        const response = await fetch(url!, { cache: "no-store" });
        const json = (await response.json()) as T;
        if (cancelled) return;

        if (!response.ok) {
          setError("Не удалось получить статус процесса.");
          return;
        }

        setData(json);
        setError(null);
        setTick((value) => value + 1);

        const status =
          (json as { state?: { status?: string } }).state?.status ??
          (json as { run?: { status?: string } }).run?.status;
        if (status && ["completed", "error", "stopped", "stale"].includes(status)) {
          onTerminalRef.current?.(json);
        }
      } catch {
        if (!cancelled) setError("Ошибка сети при опросе статуса.");
      }
    }

    poll();
    const timer = window.setInterval(poll, intervalMs);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [url, shouldPoll, intervalMs]);

  const loading = shouldPoll && !data && !error;

  return { data, loading, error, tick };
}
