"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { SearchRunProgressPanel } from "@/components/search-run-progress-panel";
import { Button, Card, Field, inputClass } from "@/components/ui";

type ProfileOption = {
  id: string;
  title: string;
  summary: string;
  resumeId: string;
  resumeTitle: string;
  searchQueries: string[];
};

type ProgressState = {
  foundLinks: number;
  collectedCards: number;
  created: number;
  duplicates: number;
  analysisQueued: number;
  analyzed: number;
  errors: number;
  recommended: number;
  needsReview: number;
  skippedByAi: number;
  coverLetters?: number;
  analysisErrors?: number;
};

const emptyProgress: ProgressState = {
  foundLinks: 0,
  collectedCards: 0,
  created: 0,
  duplicates: 0,
  analysisQueued: 0,
  analyzed: 0,
  errors: 0,
  recommended: 0,
  needsReview: 0,
  skippedByAi: 0
};

type SearchEvent = {
  type: string;
  runId?: string;
  message?: string;
  stage?: string;
  progress?: ProgressState;
  errors?: string[];
  stoppedByCaptcha?: boolean;
};

export function HhSearchForm({ profiles }: { profiles: ProfileOption[] }) {
  const [profileId, setProfileId] = useState(profiles[0]?.id || "");
  const selectedProfile = useMemo(() => profiles.find((profile) => profile.id === profileId) || null, [profileId, profiles]);
  const [enabledQueries, setEnabledQueries] = useState<Record<string, boolean>>(() =>
    Object.fromEntries((profiles[0]?.searchQueries || []).map((query) => [query, true]))
  );
  const [customQuery, setCustomQuery] = useState("");
  const [region, setRegion] = useState("");
  const [limitPerQuery, setLimitPerQuery] = useState(10);
  const [totalLimit, setTotalLimit] = useState(50);
  const [searchPeriodDays, setSearchPeriodDays] = useState("");
  const [onlyWithSalary, setOnlyWithSalary] = useState(false);
  const [analyzeAfterCollect, setAnalyzeAfterCollect] = useState(true);
  const [busy, setBusy] = useState(false);
  const [runId, setRunId] = useState("");
  const [stage, setStage] = useState("ожидает запуска");
  const [message, setMessage] = useState("");
  const [progress, setProgress] = useState<ProgressState>(emptyProgress);
  const [log, setLog] = useState<string[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [done, setDone] = useState(false);
  const [stoppedByCaptcha, setStoppedByCaptcha] = useState(false);

  function changeProfile(id: string) {
    setProfileId(id);
    const profile = profiles.find((item) => item.id === id);
    setEnabledQueries(Object.fromEntries((profile?.searchQueries || []).map((query) => [query, true])));
  }

  const queries = [
    ...(selectedProfile?.searchQueries || []).filter((query) => enabledQueries[query]),
    ...customQuery
      .split("\n")
      .map((query) => query.trim())
      .filter(Boolean)
  ];

  async function startSearch() {
    if (!selectedProfile) return;
    setBusy(true);
    setDone(false);
    setRunId("");
    setStage("подготовка браузера");
    setMessage("Открываем браузер...");
    setProgress(emptyProgress);
    setLog(["Открываем браузер..."]);
    setErrors([]);
    setStoppedByCaptcha(false);

    const response = await fetch("/api/search/hh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        searchProfileId: selectedProfile.id,
        resumeId: selectedProfile.resumeId,
        queries,
        region: region || null,
        limitPerQuery,
        totalLimit,
        onlyWithSalary,
        searchPeriodDays: searchPeriodDays ? Number(searchPeriodDays) : null,
        analyzeAfterCollect
      })
    });

    if (!response.body) {
      setBusy(false);
      setMessage("Не удалось получить поток прогресса.");
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { value, done: streamDone } = await reader.read();
      if (streamDone) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";
      for (const line of lines) {
        if (!line.trim()) continue;
        handleEvent(JSON.parse(line) as SearchEvent);
      }
    }

    setBusy(false);
  }

  function handleEvent(event: SearchEvent) {
    if (event.runId) setRunId(event.runId);
    if (event.stage) setStage(stageLabel(event.stage));
    if (event.message) {
      setMessage(event.message);
      setLog((current) => [...current.slice(-80), event.message || ""]);
    }
    if (event.progress) setProgress(event.progress);
    if (event.errors) setErrors(event.errors);
    if (event.stoppedByCaptcha) setStoppedByCaptcha(true);
    if (event.type === "done") {
      setDone(true);
      setStage("завершено");
    }
    if (event.type === "error") {
      setStage("ошибка");
      setDone(true);
    }
  }

  async function stopSearch() {
    if (!runId) return;
    await fetch(`/api/search/runs/${runId}/stop`, { method: "POST" });
    setLog((current) => [...current, "Запрошена остановка поиска. CareerOS остановится между шагами."]);
  }

  const collectPercent = Math.min(100, Math.round((progress.collectedCards / Math.max(progress.foundLinks || totalLimit, 1)) * 100));
  const aiPercent = progress.analysisQueued ? Math.min(100, Math.round((progress.analyzed / progress.analysisQueued) * 100)) : 0;

  return (
    <div className="grid gap-6">
      <Card className="grid gap-4">
        <h2 className="text-xl font-semibold tracking-normal">Профиль поиска</h2>
        <Field label="Профиль">
          <select className={inputClass} value={profileId} onChange={(event) => changeProfile(event.target.value)}>
            {profiles.map((profile) => (
              <option key={profile.id} value={profile.id}>
                {profile.title}
              </option>
            ))}
          </select>
        </Field>
        {selectedProfile ? (
          <div className="rounded-md border border-[var(--line)] bg-[var(--soft)] p-4 text-sm leading-6 text-[var(--muted)]">
            <div className="font-medium text-[var(--foreground)]">{selectedProfile.resumeTitle}</div>
            <p>{selectedProfile.summary}</p>
          </div>
        ) : (
          <p className="text-sm text-[var(--muted)]">Сначала создайте профиль поиска из резюме.</p>
        )}
      </Card>

      <Card className="grid gap-4">
        <h2 className="text-xl font-semibold tracking-normal">Поисковые запросы</h2>
        <div className="grid gap-2">
          {(selectedProfile?.searchQueries || []).map((query) => (
            <label key={query} className="flex items-center gap-2 rounded-md border border-[var(--line)] p-3 text-sm">
              <input
                type="checkbox"
                checked={Boolean(enabledQueries[query])}
                onChange={(event) => setEnabledQueries((current) => ({ ...current, [query]: event.target.checked }))}
              />
              {query}
            </label>
          ))}
        </div>
        <Field label="Свои запросы для этого запуска" hint="Каждый запрос с новой строки. В профиль они автоматически не сохраняются.">
          <textarea className={`${inputClass} min-h-28`} value={customQuery} onChange={(event) => setCustomQuery(event.target.value)} />
        </Field>
      </Card>

      <Card className="grid gap-4">
        <h2 className="text-xl font-semibold tracking-normal">Параметры поиска</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Регион / город">
            <input className={inputClass} value={region} onChange={(event) => setRegion(event.target.value)} placeholder="Москва, Санкт-Петербург или 1" />
          </Field>
          <Field label="Только новые за период">
            <select className={inputClass} value={searchPeriodDays} onChange={(event) => setSearchPeriodDays(event.target.value)}>
              <option value="">любой период</option>
              <option value="1">за сутки</option>
              <option value="3">за 3 дня</option>
              <option value="7">за неделю</option>
              <option value="30">за месяц</option>
            </select>
          </Field>
          <Field label="Лимит вакансий на запрос">
            <input className={inputClass} type="number" min={1} max={100} value={limitPerQuery} onChange={(event) => setLimitPerQuery(Number(event.target.value))} />
          </Field>
          <Field label="Общий лимит за запуск">
            <input className={inputClass} type="number" min={1} max={200} value={totalLimit} onChange={(event) => setTotalLimit(Number(event.target.value))} />
          </Field>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={onlyWithSalary} onChange={(event) => setOnlyWithSalary(event.target.checked)} />
          Искать только вакансии с указанной зарплатой
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={analyzeAfterCollect} onChange={(event) => setAnalyzeAfterCollect(event.target.checked)} />
          Быстрый AI-анализ после сбора (score без писем)
        </label>
      </Card>

      <Card className="grid gap-4">
        <h2 className="text-xl font-semibold tracking-normal">Запуск и прогресс</h2>
        {runId && busy ? <SearchRunProgressPanel runId={runId} fallbackProgress={progress} onStop={stopSearch} /> : null}
        <div className="rounded-md border border-[var(--line)] bg-[var(--soft)] p-4">
          <div className="text-sm text-[var(--muted)]">Текущий этап</div>
          <div className="mt-1 text-lg font-semibold">{stage}</div>
          <p className="mt-2 text-sm text-[var(--muted)]">{message || "Готово к запуску."}</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="Ссылок найдено" value={progress.foundLinks} />
          <Metric label="Карточек собрано" value={progress.collectedCards} />
          <Metric label="Новых вакансий" value={progress.created} />
          <Metric label="Дублей" value={progress.duplicates} />
          <Metric label="Отправлено в AI" value={progress.analysisQueued} />
          <Metric label="AI завершил" value={progress.analyzed} />
          <Metric label="Рекомендовано" value={progress.recommended} />
          <Metric label="Ошибок" value={progress.errors} />
        </div>
        <ProgressBar label="Прогресс сбора" value={collectPercent} />
        {analyzeAfterCollect ? <ProgressBar label="Прогресс AI-анализа" value={aiPercent} /> : null}
        <div className="flex flex-wrap gap-3">
          <Button onClick={startSearch} disabled={busy || !selectedProfile || queries.length === 0}>
            {busy ? "Поиск выполняется..." : "Запустить поиск"}
          </Button>
          {busy && runId ? (
            <Button variant="secondary" onClick={stopSearch}>
              Остановить поиск
            </Button>
          ) : null}
        </div>
        <div className="max-h-72 overflow-auto rounded-md border border-[var(--line)] bg-black/5 p-3 text-sm leading-6 dark:bg-white/5">
          {log.length === 0 ? (
            <p className="text-[var(--muted)]">Лог появится после запуска.</p>
          ) : (
            log.map((item, index) => <div key={`${item}-${index}`}>{item}</div>)
          )}
        </div>
      </Card>

      {done ? (
        <Card>
          <h2 className="text-2xl font-semibold tracking-normal">{stage === "ошибка" ? "Поиск завершился с ошибкой" : "Поиск завершён"}</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <Metric label="Найдено ссылок" value={progress.foundLinks} />
            <Metric label="Новых" value={progress.created} />
            <Metric label="Дублей" value={progress.duplicates} />
            <Metric label="AI-анализ" value={progress.analyzed} />
            <Metric label="Ошибок" value={progress.errors} />
            <Metric label="Рекомендовано" value={progress.recommended} />
            <Metric label="На проверке" value={progress.needsReview} />
            <Metric label="Пропущено AI" value={progress.skippedByAi} />
          </div>
          {stoppedByCaptcha ? <p className="mt-4 text-sm text-amber-700">hh показал капчу или защитную страницу. Сбор остановлен безопасно.</p> : null}
          <div className="mt-5 flex flex-wrap gap-3">
            <Link href="/vacancies" className="rounded-md border border-[var(--line)] px-4 py-2 text-sm hover:bg-[var(--soft)]">
              Открыть все найденные
            </Link>
            <Link href="/vacancies/recommended" className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white dark:text-black">
              Открыть рекомендованные
            </Link>
            <Link href="/vacancies?status=ready_to_apply" className="rounded-md border border-[var(--line)] px-4 py-2 text-sm hover:bg-[var(--soft)]">
              Готовые к отклику
            </Link>
            <Link href="/vacancies?status=no_ai" className="rounded-md border border-[var(--line)] px-4 py-2 text-sm hover:bg-[var(--soft)]">
              Проанализировать непроанализированные
            </Link>
            {runId ? (
              <Link href={`/search/runs/${runId}`} className="rounded-md border border-[var(--line)] px-4 py-2 text-sm hover:bg-[var(--soft)]">
                Детали запуска
              </Link>
            ) : null}
          </div>
          {errors.length ? (
            <details className="mt-5">
              <summary className="cursor-pointer text-sm font-medium">Посмотреть ошибки</summary>
              <ul className="mt-3 grid gap-2 text-sm text-[var(--muted)]">
                {errors.map((error) => (
                  <li key={error}>{error}</li>
                ))}
              </ul>
            </details>
          ) : null}
        </Card>
      ) : null}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-[var(--line)] p-3">
      <div className="text-xs text-[var(--muted)]">{label}</div>
      <div className="mt-2 text-2xl font-semibold tracking-normal">{value}</div>
    </div>
  );
}

function ProgressBar({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="mb-2 flex justify-between text-sm">
        <span>{label}</span>
        <span>{value}%</span>
      </div>
      <div className="h-2 rounded-full bg-[var(--soft)]">
        <div className="h-2 rounded-full bg-[var(--accent)] transition-all" style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function stageLabel(stage: string) {
  const labels: Record<string, string> = {
    preparing: "подготовка браузера",
    preparing_browser: "подготовка браузера",
    opening_hh: "открываем hh",
    manual_login: "ждём ручной вход",
    query: "выполняем запрос",
    links: "собираем ссылки",
    card: "открываем карточку вакансии",
    saving: "сохраняем вакансии",
    analyzing_ai: "анализируем AI",
    completed: "завершено",
    stopped: "остановлено",
    error: "ошибка"
  };
  return labels[stage] || stage;
}
