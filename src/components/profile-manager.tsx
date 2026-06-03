"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Field, inputClass } from "@/components/ui";

type ResumeOption = {
  id: string;
  title: string;
  aiSummary: string | null;
  aiSummaryStale: boolean;
  isActive: boolean;
};

type ProfileItem = {
  id: string;
  resumeId: string;
  resumeTitle: string;
  title: string;
  summary: string;
  targetRoles: string[];
  searchQueries: string[];
  positiveSignals: string[];
  negativeSignals: string[];
  stopWords: string[];
  status: string;
  isActive: boolean;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export function ProfileManager({
  resumes,
  profiles,
  defaultResumeId
}: {
  resumes: ResumeOption[];
  profiles: ProfileItem[];
  defaultResumeId?: string;
}) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState("");
  const [resumeId, setResumeId] = useState(defaultResumeId || resumes.find((resume) => resume.isActive)?.id || resumes[0]?.id || "");
  const selectedResume = useMemo(() => resumes.find((resume) => resume.id === resumeId) || null, [resumes, resumeId]);
  const suggestion = useMemo(() => parseResumeAnalysis(selectedResume?.aiSummary || ""), [selectedResume]);
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [roles, setRoles] = useState("");
  const [queries, setQueries] = useState("");
  const [positiveSignals, setPositiveSignals] = useState("");
  const [negativeSignals, setNegativeSignals] = useState("");
  const [stopWords, setStopWords] = useState("");
  const [makeActive, setMakeActive] = useState(true);

  function fillFromAnalysis() {
    setTitle(asText(suggestion.profile_title) || `${selectedResume?.title || "Резюме"}: профиль поиска`);
    setSummary(asText(suggestion.profile_summary));
    setRoles(lines(suggestion.target_roles || suggestion.possible_directions || []));
    setQueries(lines(suggestion.search_queries || []));
    setPositiveSignals(lines(suggestion.positive_signals || []));
    setNegativeSignals(lines(suggestion.negative_signals || []));
    setStopWords(lines(suggestion.stop_words || []));
  }

  async function createProfile() {
    setBusy("create");
    setMessage("");
    const response = await fetch("/api/profiles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        resumeId,
        title,
        summary,
        targetRoles: splitLines(roles),
        searchQueries: splitLines(queries),
        positiveSignals: splitLines(positiveSignals),
        negativeSignals: splitLines(negativeSignals),
        stopWords: splitLines(stopWords),
        makeActive
      })
    });
    const data = await response.json();
    setBusy("");
    setMessage(response.ok ? "Профиль поиска создан." : data.message || "Не удалось создать профиль.");
    if (response.ok) router.refresh();
  }

  async function profileAction(id: string, action: "activate" | "archive" | "unarchive" | "delete", payload?: Partial<ProfileItem>) {
    setBusy(`${action}:${id}`);
    setMessage("");
    const response = await fetch(`/api/profiles/${id}`, {
      method: action === "delete" ? "DELETE" : "PATCH",
      headers: action === "delete" ? undefined : { "Content-Type": "application/json" },
      body: action === "delete" ? undefined : JSON.stringify(payload || { action })
    });
    const data = await response.json();
    setBusy("");
    setMessage(response.ok ? "Готово." : data.message || "Не удалось выполнить действие.");
    if (response.ok) router.refresh();
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
      <Card className="grid content-start gap-4">
        <div>
          <h2 className="text-xl font-semibold tracking-normal">Создать профиль из резюме</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
            Выберите резюме, заполните предложения из AI-анализа и подтвердите профиль. CareerOS не создаёт профиль молча.
          </p>
        </div>
        <Field label="Резюме">
          <select className={inputClass} value={resumeId} onChange={(event) => setResumeId(event.target.value)}>
            {resumes.map((resume) => (
              <option key={resume.id} value={resume.id}>
                {resume.isActive ? "Активное · " : ""}
                {resume.title}
              </option>
            ))}
          </select>
        </Field>
        {selectedResume?.aiSummaryStale ? (
          <p className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
            AI-анализ этого резюме устарел. Лучше сначала пересоздать анализ на странице резюме.
          </p>
        ) : null}
        <Button variant="secondary" onClick={fillFromAnalysis} disabled={!selectedResume?.aiSummary}>
          Заполнить из AI-анализа
        </Button>
        <Field label="Название профиля">
          <input className={inputClass} value={title} onChange={(event) => setTitle(event.target.value)} />
        </Field>
        <Field label="Краткое описание">
          <textarea className={`${inputClass} min-h-24`} value={summary} onChange={(event) => setSummary(event.target.value)} />
        </Field>
        <Field label="Подходящие роли">
          <textarea className={`${inputClass} min-h-24`} value={roles} onChange={(event) => setRoles(event.target.value)} />
        </Field>
        <Field label="Поисковые запросы">
          <textarea className={`${inputClass} min-h-24`} value={queries} onChange={(event) => setQueries(event.target.value)} />
        </Field>
        <Field label="Положительные сигналы">
          <textarea className={`${inputClass} min-h-20`} value={positiveSignals} onChange={(event) => setPositiveSignals(event.target.value)} />
        </Field>
        <Field label="Нежелательные признаки">
          <textarea className={`${inputClass} min-h-20`} value={negativeSignals} onChange={(event) => setNegativeSignals(event.target.value)} />
        </Field>
        <Field label="Стоп-слова">
          <textarea className={`${inputClass} min-h-20`} value={stopWords} onChange={(event) => setStopWords(event.target.value)} />
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={makeActive} onChange={(event) => setMakeActive(event.target.checked)} />
          Сделать профиль активным
        </label>
        <Button onClick={createProfile} disabled={Boolean(busy) || !resumeId || !title || !summary}>
          {busy === "create" ? "Создаём..." : "Создать профиль поиска"}
        </Button>
        {message ? <p className="rounded-md border border-[var(--line)] p-3 text-sm">{message}</p> : null}
      </Card>

      <div className="grid content-start gap-4">
        {profiles.map((profile) => (
          <ProfileCard key={profile.id} profile={profile} busy={busy} onAction={profileAction} />
        ))}
      </div>
    </div>
  );
}

function ProfileCard({
  profile,
  busy,
  onAction
}: {
  profile: ProfileItem;
  busy: string;
  onAction: (id: string, action: "activate" | "archive" | "unarchive" | "delete", payload?: Partial<ProfileItem>) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(profile.title);
  const [summary, setSummary] = useState(profile.summary);
  const [roles, setRoles] = useState(lines(profile.targetRoles));
  const [queries, setQueries] = useState(lines(profile.searchQueries));

  const archived = profile.status === "archived" || Boolean(profile.archivedAt);
  return (
    <Card className={archived ? "opacity-70" : ""}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-normal">{profile.title}</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">Из резюме: {profile.resumeTitle}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {profile.isActive ? <Badge>активный</Badge> : null}
          {archived ? <Badge>архив</Badge> : <Badge>доступен в поиске</Badge>}
        </div>
      </div>
      {editing ? (
        <div className="mt-4 grid gap-3">
          <Field label="Название">
            <input className={inputClass} value={title} onChange={(event) => setTitle(event.target.value)} />
          </Field>
          <Field label="Описание">
            <textarea className={`${inputClass} min-h-24`} value={summary} onChange={(event) => setSummary(event.target.value)} />
          </Field>
          <Field label="Роли">
            <textarea className={`${inputClass} min-h-24`} value={roles} onChange={(event) => setRoles(event.target.value)} />
          </Field>
          <Field label="Поисковые запросы">
            <textarea className={`${inputClass} min-h-24`} value={queries} onChange={(event) => setQueries(event.target.value)} />
          </Field>
        </div>
      ) : (
        <>
          <p className="mt-4 text-sm leading-6 text-[var(--muted)]">{profile.summary}</p>
          <Tags title="Подходящие роли" items={profile.targetRoles} />
          <Tags title="Поисковые запросы" items={profile.searchQueries} />
        </>
      )}
      <div className="mt-5 flex flex-wrap gap-3">
        {editing ? (
          <Button
            onClick={() =>
              onAction(profile.id, "activate", {
                title,
                summary,
                targetRoles: splitLines(roles),
                searchQueries: splitLines(queries)
              })
            }
            disabled={Boolean(busy)}
          >
            Сохранить
          </Button>
        ) : (
          <Button variant="secondary" onClick={() => setEditing(true)} disabled={Boolean(busy)}>
            Редактировать
          </Button>
        )}
        {!profile.isActive && !archived ? (
          <Button variant="secondary" onClick={() => onAction(profile.id, "activate")} disabled={Boolean(busy)}>
            Сделать активным
          </Button>
        ) : null}
        {archived ? (
          <Button variant="secondary" onClick={() => onAction(profile.id, "unarchive")} disabled={Boolean(busy)}>
            Вернуть из архива
          </Button>
        ) : (
          <Button variant="secondary" onClick={() => onAction(profile.id, "archive")} disabled={Boolean(busy)}>
            Архивировать
          </Button>
        )}
        <Button variant="secondary" onClick={() => onAction(profile.id, "delete")} disabled={Boolean(busy)}>
          Удалить
        </Button>
      </div>
    </Card>
  );
}

function parseResumeAnalysis(text: string): Record<string, string | string[]> {
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

function asText(value: string | string[] | undefined) {
  return typeof value === "string" ? value : "";
}

function splitLines(value: string) {
  return value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

function lines(value: string[] | string | undefined) {
  return Array.isArray(value) ? value.join("\n") : value || "";
}

function Badge({ children }: { children: React.ReactNode }) {
  return <span className="rounded-md border border-[var(--line)] px-3 py-1 text-xs text-[var(--muted)]">{children}</span>;
}

function Tags({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <div className="mt-4">
      <h3 className="text-sm font-semibold">{title}</h3>
      <div className="mt-2 flex flex-wrap gap-2">
        {items.map((item) => (
          <span key={item} className="rounded-md bg-[var(--soft)] px-3 py-1 text-sm text-[var(--muted)]">
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}
