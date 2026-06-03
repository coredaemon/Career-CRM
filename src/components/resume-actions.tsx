"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, Card } from "@/components/ui";

export function ResumeActions({ resume }: { resume: { id: string; isActive: boolean; isArchived: boolean } }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  async function patch(action: "activate" | "archive" | "unarchive") {
    setBusy(action);
    setMessage("");
    const response = await fetch(`/api/resumes/${resume.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action })
    });
    const data = await response.json();
    setBusy(null);
    setMessage(response.ok ? "Готово." : data.message || "Не удалось выполнить действие.");
    if (response.ok) router.refresh();
  }

  async function remove() {
    if (!confirm("Удалить резюме? Если оно уже связано с профилями, письмами или откликами, CareerOS безопасно отправит его в архив.")) return;
    setBusy("delete");
    setMessage("");
    const response = await fetch(`/api/resumes/${resume.id}`, { method: "DELETE" });
    const data = await response.json();
    setBusy(null);
    if (!response.ok) {
      setMessage(data.message || "Не удалось удалить резюме.");
      return;
    }
    if (data.mode === "deleted") {
      router.push("/resumes");
      router.refresh();
      return;
    }
    setMessage("Резюме связано с историей, поэтому оно архивировано, а не удалено физически.");
    router.refresh();
  }

  return (
    <Card className="grid gap-3">
      <h2 className="text-lg font-semibold tracking-normal">Действия</h2>
      <Link href={`/profiles?resumeId=${resume.id}`} className="rounded-md bg-[var(--accent)] px-4 py-2 text-center text-sm font-medium text-white dark:text-black">
        Создать профиль поиска
      </Link>
      {!resume.isActive && !resume.isArchived ? (
        <Button variant="secondary" onClick={() => patch("activate")} disabled={Boolean(busy)}>
          Сделать активным
        </Button>
      ) : null}
      {resume.isArchived ? (
        <Button variant="secondary" onClick={() => patch("unarchive")} disabled={Boolean(busy)}>
          Вернуть из архива
        </Button>
      ) : (
        <Button variant="secondary" onClick={() => patch("archive")} disabled={Boolean(busy)}>
          Архивировать
        </Button>
      )}
      <Button variant="secondary" onClick={remove} disabled={Boolean(busy)}>
        Удалить резюме
      </Button>
      {message ? <p className="text-sm text-[var(--muted)]">{message}</p> : null}
    </Card>
  );
}

