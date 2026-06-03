"use client";

import { useEffect, useRef } from "react";

function logLineClass(line: string) {
  const lower = line.toLowerCase();
  if (/ошибк|error|не смог|не удался|failed/i.test(lower)) return "text-red-300";
  if (/пропущ|капч|останов|skipped|warning/i.test(lower)) return "text-amber-300";
  if (/сохранил|заверш|рекоменд|готово|создано/i.test(lower)) return "text-emerald-300";
  return "text-zinc-200";
}

export function ProcessLogPanel({
  lines,
  emptyText = "Лог пуст.",
  maxHeightClass = "max-h-72",
  textSizeClass = "text-sm",
  autoScroll = false
}: {
  lines: string[];
  emptyText?: string;
  maxHeightClass?: string;
  textSizeClass?: string;
  autoScroll?: boolean;
}) {
  const endRef = useRef<HTMLDivElement>(null);

  const lastLine = lines.length > 0 ? lines[lines.length - 1] : "";
  useEffect(() => {
    if (!autoScroll || lines.length === 0) return;
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [autoScroll, lines.length, lastLine]);

  return (
    <div
      className={`overflow-auto rounded-md border border-[var(--line)] bg-zinc-950/95 p-3 leading-6 text-zinc-100 ${maxHeightClass} ${textSizeClass}`}
    >
      {lines.length === 0 ? (
        <p className="text-zinc-400">{emptyText}</p>
      ) : (
        lines.map((line, index) => (
          <div key={`log-line-${index}`} className={logLineClass(line)}>
            {line}
          </div>
        ))
      )}
      {autoScroll ? <div ref={endRef} aria-hidden /> : null}
    </div>
  );
}
