"use client";

import { useEffect, useMemo, useState } from "react";
import { aiProviderPresets } from "@/lib/ai";
import { Button, Card, Field, inputClass } from "@/components/ui";

type AiForm = {
  aiProvider: string;
  aiBaseUrl: string;
  aiApiKey: string;
  aiPrimaryModel: string;
  aiFastModel: string;
};

type AiSettingsPanelProps = {
  compact?: boolean;
  onSaved?: (settings: AiForm) => void;
};

const initialForm: AiForm = {
  aiProvider: "openai",
  aiBaseUrl: "https://api.openai.com/v1",
  aiApiKey: "",
  aiPrimaryModel: "gpt-4.1",
  aiFastModel: "gpt-4.1-mini"
};

export function AiSettingsPanel({ compact, onSaved }: AiSettingsPanelProps) {
  const [form, setForm] = useState<AiForm>(initialForm);
  const [models, setModels] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState<"test" | "save" | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [hasSavedKey, setHasSavedKey] = useState(false);
  const [keyMask, setKeyMask] = useState("");
  const [replaceKey, setReplaceKey] = useState(true);

  const provider = useMemo(
    () => aiProviderPresets.find((item) => item.id === form.aiProvider) ?? aiProviderPresets[0],
    [form.aiProvider]
  );

  useEffect(() => {
    fetch("/api/settings/ai")
      .then((response) => response.json())
      .then((data) => {
        const preset = aiProviderPresets.find((item) => item.id === data.aiProvider) ?? aiProviderPresets[0];
        setHasSavedKey(Boolean(data.hasApiKey));
        setKeyMask(data.apiKeyMask || "");
        setReplaceKey(!data.hasApiKey);
        setForm({
          aiProvider: data.aiProvider || preset.id,
          aiBaseUrl: data.aiBaseUrl || preset.baseUrl,
          aiApiKey: "",
          aiPrimaryModel: data.aiPrimaryModel || preset.defaultPrimaryModel,
          aiFastModel: data.aiFastModel || preset.defaultFastModel
        });
      })
      .catch(() => {
        setMessage("Не удалось загрузить сохранённые настройки AI.");
      });
  }, []);

  function selectProvider(providerId: string) {
    const next = aiProviderPresets.find((item) => item.id === providerId) ?? aiProviderPresets[0];
    setModels([]);
    setMessage(next.enabled ? "" : "Google Gemini появится позже. Сейчас выберите OpenAI, DeepSeek или OpenAI-совместимый API.");
    setForm((current) => ({
      ...current,
      aiProvider: next.id,
      aiBaseUrl: next.baseUrl,
      aiPrimaryModel: next.defaultPrimaryModel,
      aiFastModel: next.defaultFastModel
    }));
    setShowAdvanced(next.id === "compatible");
  }

  async function testKey() {
    setBusy("test");
    setMessage("");
    const response = await fetch("/api/settings/ai/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form)
    });
    const data = await response.json();
    setBusy(null);
    if (!response.ok) {
      setMessage(data.message);
      return;
    }

    setModels(data.models || []);
    setForm((current) => ({
      ...current,
      aiBaseUrl: data.baseUrl || current.aiBaseUrl,
      aiPrimaryModel: data.recommended?.primary || current.aiPrimaryModel,
      aiFastModel: data.recommended?.fast || current.aiFastModel
    }));
    setMessage(data.models?.length ? "Ключ проверен. Модели загружены." : "Ключ проверен. Используются рекомендованные модели.");
  }

  async function saveSettings() {
    setBusy("save");
    setMessage("");
    const response = await fetch("/api/settings/ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        aiApiKey: replaceKey ? form.aiApiKey : undefined
      })
    });
    const data = await response.json();
    setBusy(null);
    setMessage(data.message);
    if (response.ok) {
      setHasSavedKey(Boolean(data.hasApiKey));
      setKeyMask(data.apiKeyMask || "");
      setReplaceKey(false);
      setForm((current) => ({ ...current, aiApiKey: "" }));
      onSaved?.({ ...form, aiApiKey: "" });
    }
  }

  const canTest = provider.enabled && (form.aiApiKey || hasSavedKey) && form.aiBaseUrl && form.aiPrimaryModel && form.aiFastModel;
  const canSave = provider.enabled && (form.aiApiKey || hasSavedKey) && form.aiPrimaryModel && form.aiFastModel;

  return (
    <div className="grid gap-5">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {aiProviderPresets.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => selectProvider(item.id)}
            className={`focus-ring rounded-lg border p-4 text-left transition ${
              form.aiProvider === item.id ? "border-[var(--accent)] bg-[var(--soft)]" : "border-[var(--line)] bg-[var(--panel)]"
            } ${!item.enabled ? "opacity-60" : ""}`}
          >
            <div className="font-semibold">{item.title}</div>
            <p className="mt-2 text-sm leading-5 text-[var(--muted)]">{item.description}</p>
            {!item.enabled ? <div className="mt-3 text-xs text-[var(--muted)]">Скоро</div> : null}
          </button>
        ))}
      </div>

      <Card className={`grid gap-4 ${compact ? "" : "max-w-3xl"}`}>
        <div>
          <h2 className="text-xl font-semibold tracking-normal">Проверка доступа</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
            Для известных провайдеров CareerOS сам подставит адрес API и предложит модели. API-ключ хранится только локально.
          </p>
        </div>

        {hasSavedKey && !replaceKey ? (
          <div className="flex flex-wrap items-center gap-3 rounded-md border border-[var(--line)] bg-[var(--soft)] p-3 text-sm">
            <span>Сохранённый ключ: {keyMask}</span>
            <Button variant="secondary" onClick={() => setReplaceKey(true)}>
              Заменить ключ
            </Button>
          </div>
        ) : (
          <Field label="API-ключ">
            <input
              className={inputClass}
              type="password"
              value={form.aiApiKey}
              onChange={(event) => setForm({ ...form, aiApiKey: event.target.value })}
              placeholder="Вставьте ключ провайдера"
            />
          </Field>
        )}

        {form.aiProvider === "compatible" ? (
          <div className="grid gap-3">
            <button type="button" className="w-fit text-sm text-[var(--accent)]" onClick={() => setShowAdvanced(!showAdvanced)}>
              {showAdvanced ? "Скрыть расширенные настройки" : "Показать расширенные настройки"}
            </button>
            {showAdvanced ? (
              <div className="grid gap-4 rounded-md border border-[var(--line)] p-4">
                <Field label="Base URL">
                  <input
                    className={inputClass}
                    value={form.aiBaseUrl}
                    onChange={(event) => setForm({ ...form, aiBaseUrl: event.target.value })}
                    placeholder="https://example.com/v1"
                  />
                </Field>
                <Field label="Основная модель">
                  <input className={inputClass} value={form.aiPrimaryModel} onChange={(event) => setForm({ ...form, aiPrimaryModel: event.target.value })} />
                </Field>
                <Field label="Быстрая модель">
                  <input className={inputClass} value={form.aiFastModel} onChange={(event) => setForm({ ...form, aiFastModel: event.target.value })} />
                </Field>
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="flex flex-wrap gap-3">
          <Button onClick={testKey} disabled={!canTest || Boolean(busy)}>
            {busy === "test" ? "Проверяем..." : "Проверить ключ"}
          </Button>
          <Button variant="secondary" onClick={testKey} disabled={!canTest || Boolean(busy)}>
            Проверить снова
          </Button>
        </div>

        {models.length ? (
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Основная модель">
              <select className={inputClass} value={form.aiPrimaryModel} onChange={(event) => setForm({ ...form, aiPrimaryModel: event.target.value })}>
                {models.map((model) => (
                  <option key={model} value={model}>
                    {model}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Быстрая модель">
              <select className={inputClass} value={form.aiFastModel} onChange={(event) => setForm({ ...form, aiFastModel: event.target.value })}>
                {models.map((model) => (
                  <option key={model} value={model}>
                    {model}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        ) : form.aiProvider !== "compatible" ? (
          <div className="grid gap-3 rounded-md border border-[var(--line)] p-4 text-sm">
            <div>Основная модель: {form.aiPrimaryModel || "будет выбрана после проверки"}</div>
            <div>Быстрая модель: {form.aiFastModel || "будет выбрана после проверки"}</div>
          </div>
        ) : null}

        <Button onClick={saveSettings} disabled={!canSave || Boolean(busy)}>
          {busy === "save" ? "Сохраняем..." : "Сохранить настройки"}
        </Button>
      </Card>

      {message ? <p className="rounded-md border border-[var(--line)] bg-[var(--panel)] p-3 text-sm">{message}</p> : null}
    </div>
  );
}
