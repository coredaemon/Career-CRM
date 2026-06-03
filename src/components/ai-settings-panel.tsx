"use client";

import { useEffect, useState } from "react";
import { providerPresets } from "@/lib/ai-presets";
import { Button, Card, Field, inputClass } from "@/components/ui";

type Contour = "analysis" | "writer";

type ContourState = {
  provider: string;
  baseUrl: string;
  apiKey: string;
  primaryModel: string;
  secondaryModel: string;
  hasKey: boolean;
  keyMask: string;
  models: string[];
  showAdvanced: boolean;
  replaceKey: boolean;
};

const deepseek = providerPresets.find((item) => item.id === "deepseek")!;
const openai = providerPresets.find((item) => item.id === "openai")!;
const compatible = providerPresets.find((item) => item.id === "compatible")!;

function initialContour(preset: typeof deepseek, primary = "", secondary = ""): ContourState {
  return {
    provider: preset.id,
    baseUrl: preset.baseUrl,
    apiKey: "",
    primaryModel: primary || preset.defaults.analysis || preset.defaults.writer || "",
    secondaryModel: secondary || preset.defaults.fast || preset.defaults.reviewer || "",
    hasKey: false,
    keyMask: "",
    models: [],
    showAdvanced: false,
    replaceKey: true
  };
}

export function AiSettingsPanel({ onSaved }: { compact?: boolean; onSaved?: () => void }) {
  const [analysis, setAnalysis] = useState<ContourState>(initialContour(deepseek, "deepseek-v4-flash", "deepseek-v4-flash"));
  const [writer, setWriter] = useState<ContourState>(initialContour(openai, "gpt-5.4-mini", "gpt-5.4-mini"));
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch("/api/settings/ai")
      .then((response) => response.json())
      .then((data) => {
        setAnalysis((current) => ({
          ...current,
          provider: data.analysisProvider || "deepseek",
          baseUrl: data.analysisBaseUrl || deepseek.baseUrl,
          primaryModel: data.analysisModel || "deepseek-v4-flash",
          secondaryModel: data.fastModel || "deepseek-v4-flash",
          hasKey: Boolean(data.hasAnalysisKey),
          keyMask: data.analysisKeyMask || "",
          replaceKey: !data.hasAnalysisKey
        }));
        setWriter((current) => ({
          ...current,
          provider: data.writerProvider || "openai",
          baseUrl: data.writerBaseUrl || openai.baseUrl,
          primaryModel: data.writerModel || "gpt-5.4-mini",
          secondaryModel: data.reviewerModel || "gpt-5.4-mini",
          hasKey: Boolean(data.hasWriterKey),
          keyMask: data.writerKeyMask || "",
          replaceKey: !data.hasWriterKey
        }));
      })
      .catch(() => setMessage("Не удалось загрузить настройки AI."));
  }, []);

  function selectProvider(contour: Contour, provider: string) {
    const preset = providerPresets.find((item) => item.id === provider) ?? compatible;
    const updater = contour === "analysis" ? setAnalysis : setWriter;
    const primaryRole = contour === "analysis" ? "analysis" : "writer";
    const secondaryRole = contour === "analysis" ? "fast" : "reviewer";
    updater((current) => ({
      ...current,
      provider,
      baseUrl: preset.baseUrl,
      primaryModel: preset.defaults[primaryRole] || "",
      secondaryModel: preset.defaults[secondaryRole] || "",
      models: [],
      showAdvanced: provider === "compatible"
    }));
  }

  async function testContour(contour: Contour) {
    const state = contour === "analysis" ? analysis : writer;
    setBusy(contour);
    setMessage("");
    const response = await fetch("/api/settings/ai/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contour,
        provider: state.provider,
        baseUrl: state.baseUrl,
        apiKey: state.replaceKey ? state.apiKey : undefined,
        primaryModel: state.primaryModel,
        secondaryModel: state.secondaryModel
      })
    });
    const data = await response.json();
    setBusy("");
    if (!response.ok) {
      setMessage(data.message);
      return;
    }
    const updater = contour === "analysis" ? setAnalysis : setWriter;
    updater((current) => ({
      ...current,
      models: data.models || [],
      primaryModel: data.recommended?.primary || current.primaryModel,
      secondaryModel: data.recommended?.secondary || current.secondaryModel
    }));
    setMessage(`${contour === "analysis" ? "Аналитик" : "Писатель"}: ключ проверен.`);
  }

  async function save() {
    setBusy("save");
    setMessage("");
    const response = await fetch("/api/settings/ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        analysisProvider: analysis.provider,
        analysisBaseUrl: analysis.baseUrl,
        analysisApiKey: analysis.replaceKey ? analysis.apiKey : undefined,
        analysisModel: analysis.primaryModel,
        fastModel: analysis.secondaryModel,
        writerProvider: writer.provider,
        writerBaseUrl: writer.baseUrl,
        writerApiKey: writer.replaceKey ? writer.apiKey : undefined,
        writerModel: writer.primaryModel,
        reviewerModel: writer.secondaryModel
      })
    });
    const data = await response.json();
    setBusy("");
    setMessage(data.message);
    if (response.ok) {
      setAnalysis((current) => ({ ...current, apiKey: "", hasKey: true, keyMask: data.analysisKeyMask, replaceKey: false }));
      setWriter((current) => ({ ...current, apiKey: "", hasKey: true, keyMask: data.writerKeyMask, replaceKey: false }));
      onSaved?.();
    }
  }

  return (
    <div className="grid gap-5">
      <Card>
        <h2 className="text-xl font-semibold tracking-normal">Схема работы</h2>
        <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
          CareerOS использует два контура AI: аналитик разбирает вакансии и считает score, писатель готовит тексты, которые вы будете читать
          и отправлять.
        </p>
      </Card>
      <ContourPanel
        title="Аналитик"
        description="Используется для разбора вакансий, JSON-анализа, score, red flags и массовой обработки. Обычно сюда ставится более дешёвый провайдер."
        contour="analysis"
        allowedProviders={[deepseek, compatible]}
        state={analysis}
        setState={setAnalysis}
        onProvider={selectProvider}
        onTest={testContour}
        busy={busy === "analysis"}
        primaryLabel="Модель анализа"
        secondaryLabel="Быстрая модель"
      />
      <ContourPanel
        title="Писатель и проверяющий"
        description="Используется для сопроводительных писем, follow-up сообщений, красивых объяснений и спорных решений."
        contour="writer"
        allowedProviders={[openai, compatible]}
        state={writer}
        setState={setWriter}
        onProvider={selectProvider}
        onTest={testContour}
        busy={busy === "writer"}
        primaryLabel="Модель письма"
        secondaryLabel="Модель проверки спорных случаев"
      />
      <Button onClick={save} disabled={Boolean(busy) || !analysis.primaryModel || !writer.primaryModel}>
        {busy === "save" ? "Сохраняем..." : "Сохранить настройки"}
      </Button>
      {message ? <p className="rounded-md border border-[var(--line)] bg-[var(--panel)] p-3 text-sm">{message}</p> : null}
    </div>
  );
}

function ContourPanel({
  title,
  description,
  contour,
  allowedProviders,
  state,
  setState,
  onProvider,
  onTest,
  busy,
  primaryLabel,
  secondaryLabel
}: {
  title: string;
  description: string;
  contour: Contour;
  allowedProviders: typeof providerPresets;
  state: ContourState;
  setState: (updater: (current: ContourState) => ContourState) => void;
  onProvider: (contour: Contour, provider: string) => void;
  onTest: (contour: Contour) => void;
  busy: boolean;
  primaryLabel: string;
  secondaryLabel: string;
}) {
  return (
    <Card className="grid gap-4">
      <div>
        <h2 className="text-xl font-semibold tracking-normal">{title}</h2>
        <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{description}</p>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {allowedProviders.map((provider) => (
          <button
            key={provider.id}
            type="button"
            onClick={() => onProvider(contour, provider.id)}
            className={`focus-ring rounded-lg border p-4 text-left ${
              state.provider === provider.id ? "border-[var(--accent)] bg-[var(--soft)]" : "border-[var(--line)]"
            }`}
          >
            <div className="font-semibold">{provider.title}</div>
            <p className="mt-2 text-sm leading-5 text-[var(--muted)]">{provider.description}</p>
          </button>
        ))}
      </div>
      {state.hasKey && !state.replaceKey ? (
        <div className="flex flex-wrap items-center gap-3 rounded-md border border-[var(--line)] bg-[var(--soft)] p-3 text-sm">
          <span>Сохранённый ключ: {state.keyMask}</span>
          <Button variant="secondary" onClick={() => setState((current) => ({ ...current, replaceKey: true }))}>
            Заменить ключ
          </Button>
        </div>
      ) : (
        <Field label="API-ключ">
          <input
            className={inputClass}
            type="password"
            value={state.apiKey}
            onChange={(event) => setState((current) => ({ ...current, apiKey: event.target.value }))}
            placeholder="Вставьте ключ провайдера"
          />
        </Field>
      )}
      <button
        type="button"
        className="w-fit text-sm text-[var(--accent)]"
        onClick={() => setState((current) => ({ ...current, showAdvanced: !current.showAdvanced }))}
      >
        {state.showAdvanced ? "Скрыть расширенные настройки" : "Показать расширенные настройки"}
      </button>
      {state.showAdvanced || state.provider === "compatible" ? (
        <Field label="Base URL">
          <input className={inputClass} value={state.baseUrl} onChange={(event) => setState((current) => ({ ...current, baseUrl: event.target.value }))} />
        </Field>
      ) : null}
      <Button variant="secondary" onClick={() => onTest(contour)} disabled={busy || (!state.apiKey && !state.hasKey)}>
        {busy ? "Проверяем..." : "Проверить"}
      </Button>
      <div className="grid gap-4 md:grid-cols-2">
        <ModelField label={primaryLabel} value={state.primaryModel} models={state.models} onChange={(value) => setState((current) => ({ ...current, primaryModel: value }))} />
        <ModelField label={secondaryLabel} value={state.secondaryModel} models={state.models} onChange={(value) => setState((current) => ({ ...current, secondaryModel: value }))} />
      </div>
    </Card>
  );
}

function ModelField({ label, value, models, onChange }: { label: string; value: string; models: string[]; onChange: (value: string) => void }) {
  return (
    <Field label={label}>
      {models.length ? (
        <select className={inputClass} value={value} onChange={(event) => onChange(event.target.value)}>
          {models.map((model) => (
            <option key={model} value={model}>
              {model}
            </option>
          ))}
        </select>
      ) : (
        <input className={inputClass} value={value} onChange={(event) => onChange(event.target.value)} />
      )}
    </Field>
  );
}
