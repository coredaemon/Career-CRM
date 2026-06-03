"use client";

import { useEffect, useState } from "react";
import { Button, Card } from "@/components/ui";

type Observation = {
  id: string;
  sourceType: string;
  sourceId: string | null;
  description: string;
  evidenceJson: string;
  suggestedRule: string | null;
  status: string;
  createdAt: string;
};

type Evidence = {
  vacancyTitle?: string;
  companyName?: string | null;
  quickReasons?: string[];
  userComment?: string;
};

function parseEvidence(json: string): Evidence {
  try {
    return JSON.parse(json) as Evidence;
  } catch {
    return {};
  }
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("ru-RU", { day: "2-digit", month: "short", year: "numeric" });
}

export function MemoryObservationsPanel() {
  const [observations, setObservations] = useState<Observation[]>([]);
  const [acceptedObs, setAcceptedObs] = useState<Observation[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");

  function load() {
    Promise.all([
      fetch("/api/memory/observations?status=draft").then((r) => r.json()),
      fetch("/api/memory/observations?status=accepted").then((r) => r.json())
    ]).then(([draftData, acceptedData]) => {
      setObservations((draftData as { observations: Observation[] }).observations ?? []);
      setAcceptedObs((acceptedData as { observations: Observation[] }).observations ?? []);
    });
  }

  useEffect(() => {
    Promise.all([
      fetch("/api/memory/observations?status=draft").then((r) => r.json()),
      fetch("/api/memory/observations?status=accepted").then((r) => r.json())
    ]).then(([draftData, acceptedData]) => {
      setObservations((draftData as { observations: Observation[] }).observations ?? []);
      setAcceptedObs((acceptedData as { observations: Observation[] }).observations ?? []);
    });
  }, []);

  async function patch(id: string, data: { status?: string; suggestedRule?: string }) {
    setBusy(id);
    await fetch(`/api/memory/observations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });
    setBusy(null);
    setEditingId(null);
    await load();
  }

  async function remove(id: string) {
    setBusy(id);
    await fetch(`/api/memory/observations/${id}`, { method: "DELETE" });
    setBusy(null);
    await load();
  }

  function startEdit(obs: Observation) {
    setEditingId(obs.id);
    setEditText(obs.suggestedRule ?? obs.description);
  }

  return (
    <div className="grid gap-6">
      <Card>
        <h2 className="text-xl font-semibold tracking-normal">Черновые наблюдения</h2>
        <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
          Появляются, когда вы отказываетесь от вакансии с причиной. Примите их как правило, измените формулировку или отклоните.
          Только <strong>принятые</strong> правила влияют на будущий AI-анализ.
        </p>

        {observations.length === 0 ? (
          <p className="mt-4 text-sm text-[var(--muted)]">Черновых наблюдений нет. Они появятся после нажатия «Не подходит» на вакансии.</p>
        ) : (
          <div className="mt-4 grid gap-4">
            {observations.map((obs) => {
              const evidence = parseEvidence(obs.evidenceJson);
              return (
                <div key={obs.id} className="rounded-lg border border-[var(--line)] p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="grid gap-1">
                      <div className="text-xs text-[var(--muted)]">{formatDate(obs.createdAt)}</div>
                      {evidence.vacancyTitle && (
                        <div className="text-sm font-medium">{evidence.vacancyTitle}{evidence.companyName ? ` · ${evidence.companyName}` : ""}</div>
                      )}
                    </div>
                  </div>

                  {evidence.quickReasons && evidence.quickReasons.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {evidence.quickReasons.map((r) => (
                        <span key={r} className="rounded-full border border-[var(--line)] px-2 py-0.5 text-xs text-[var(--muted)]">{r}</span>
                      ))}
                    </div>
                  )}

                  {evidence.userComment && (
                    <p className="mt-2 text-sm italic text-[var(--muted)]">«{evidence.userComment}»</p>
                  )}

                  {editingId === obs.id ? (
                    <div className="mt-3 grid gap-2">
                      <textarea
                        className="w-full rounded-md border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]"
                        rows={3}
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                      />
                      <div className="flex gap-2">
                        <Button onClick={() => patch(obs.id, { status: "accepted", suggestedRule: editText })} disabled={busy === obs.id}>
                          Принять с изменением
                        </Button>
                        <Button variant="secondary" onClick={() => setEditingId(null)} disabled={busy === obs.id}>
                          Отмена
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      {obs.suggestedRule && (
                        <div className="mt-3 rounded-md bg-[var(--soft)] px-3 py-2 text-sm">
                          <span className="text-xs font-medium text-[var(--muted)]">Предложенное правило: </span>
                          {obs.suggestedRule}
                        </div>
                      )}
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button onClick={() => patch(obs.id, { status: "accepted" })} disabled={busy === obs.id}>
                          {busy === obs.id ? "..." : "Принять как правило"}
                        </Button>
                        <Button variant="secondary" onClick={() => startEdit(obs)} disabled={busy === obs.id}>
                          Изменить
                        </Button>
                        <Button variant="secondary" onClick={() => patch(obs.id, { status: "rejected" })} disabled={busy === obs.id}>
                          Отклонить
                        </Button>
                        <Button variant="secondary" onClick={() => remove(obs.id)} disabled={busy === obs.id}>
                          Удалить
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {acceptedObs.length > 0 && (
        <Card>
          <h2 className="text-xl font-semibold tracking-normal">Активные правила</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
            Эти правила передаются в AI при анализе каждой новой вакансии.
          </p>
          <div className="mt-4 grid gap-3">
            {acceptedObs.map((obs) => (
              <div key={obs.id} className="flex items-start gap-3 rounded-lg border border-[var(--line)] p-4">
                <div className="mt-0.5 h-2 w-2 flex-none rounded-full bg-green-500" />
                <div className="grid gap-1">
                  <div className="text-sm">{obs.suggestedRule ?? obs.description}</div>
                  <div className="text-xs text-[var(--muted)]">{formatDate(obs.createdAt)}</div>
                </div>
                <div className="ml-auto flex gap-2">
                  <Button variant="secondary" onClick={() => patch(obs.id, { status: "rejected" })} disabled={busy === obs.id}>
                    Деактивировать
                  </Button>
                  <Button variant="secondary" onClick={() => remove(obs.id)} disabled={busy === obs.id}>
                    Удалить
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
