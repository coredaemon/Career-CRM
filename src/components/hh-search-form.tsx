"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Button, Card, Field, inputClass } from "@/components/ui";

type ProfileOption = {
  id: string;
  title: string;
  summary: string;
  resumeId: string;
  resumeTitle: string;
  searchQueries: string[];
};

type SearchResult = {
  totals?: {
    found: number;
    created: number;
    duplicates: number;
    analyzed: number;
    errors: number;
  };
  stoppedByCaptcha?: boolean;
  errors?: string[];
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
  const [message, setMessage] = useState("");
  const [result, setResult] = useState<SearchResult | null>(null);

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
    setMessage("Открываем браузер и запускаем поиск. Если hh попросит войти, сделайте это вручную в открывшемся окне.");
    setResult(null);

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
    const data = await response.json();
    setBusy(false);
    setResult(data);
    setMessage(response.ok ? "Поиск завершён." : data.message || "Поиск остановлен с ошибкой.");
  }

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
          <Field label="Регион / город" hint="Можно указать город словами или area id hh, если знаете его.">
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
          Проанализировать новые вакансии AI после сбора
        </label>
        {totalLimit > 50 ? (
          <p className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
            Лимит больше 50 может выглядеть для hh как агрессивный сбор. Лучше запускать небольшие партии.
          </p>
        ) : null}
      </Card>

      <Card className="grid gap-4">
        <h2 className="text-xl font-semibold tracking-normal">Запуск</h2>
        <p className="text-sm leading-6 text-[var(--muted)]">
          CareerOS откроет обычный браузер Playwright с локальным профилем. Логин в hh, капчи и любые подтверждения выполняются только вручную пользователем.
        </p>
        <Button onClick={startSearch} disabled={busy || !selectedProfile || queries.length === 0}>
          {busy ? "Поиск выполняется..." : "Запустить поиск"}
        </Button>
        {message ? <p className="rounded-md border border-[var(--line)] bg-[var(--soft)] p-3 text-sm">{message}</p> : null}
      </Card>

      {result?.totals ? (
        <Card>
          <h2 className="text-xl font-semibold tracking-normal">Результат</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <Metric label="Найдено ссылок" value={result.totals.found} />
            <Metric label="Новых" value={result.totals.created} />
            <Metric label="Дублей" value={result.totals.duplicates} />
            <Metric label="AI-анализ" value={result.totals.analyzed} />
            <Metric label="Ошибок" value={result.totals.errors} />
          </div>
          {result.stoppedByCaptcha ? <p className="mt-4 text-sm text-amber-700">Сбор остановлен: hh показал защитную страницу или капчу.</p> : null}
          <div className="mt-5 flex flex-wrap gap-3">
            <Link href="/vacancies" className="rounded-md border border-[var(--line)] px-4 py-2 text-sm hover:bg-[var(--soft)]">
              Открыть найденные вакансии
            </Link>
            <Link href="/vacancies/recommended" className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white dark:text-black">
              Перейти к рекомендованным
            </Link>
          </div>
          {result.errors?.length ? (
            <details className="mt-5">
              <summary className="cursor-pointer text-sm font-medium">Посмотреть ошибки</summary>
              <ul className="mt-3 grid gap-2 text-sm text-[var(--muted)]">
                {result.errors.map((error) => (
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
