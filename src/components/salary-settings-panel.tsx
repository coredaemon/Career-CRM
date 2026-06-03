"use client";

import { useEffect, useState } from "react";
import { Button, Card, Field, inputClass } from "@/components/ui";

type SalaryState = {
  salaryExpectationMin: string;
  salaryExpectationMax: string;
  salaryExpectationPreferredText: string;
  salaryExpectationNet: boolean;
};

export function SalarySettingsPanel() {
  const [form, setForm] = useState<SalaryState>({
    salaryExpectationMin: "",
    salaryExpectationMax: "",
    salaryExpectationPreferredText: "",
    salaryExpectationNet: true
  });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch("/api/settings/profile")
      .then((r) => r.json())
      .then((data) => {
        setForm({
          salaryExpectationMin: data.salaryExpectationMin != null ? String(data.salaryExpectationMin) : "",
          salaryExpectationMax: data.salaryExpectationMax != null ? String(data.salaryExpectationMax) : "",
          salaryExpectationPreferredText: data.salaryExpectationPreferredText ?? "",
          salaryExpectationNet: data.salaryExpectationNet ?? true
        });
      })
      .catch(() => setMessage("Не удалось загрузить настройки."));
  }, []);

  async function save() {
    setBusy(true);
    setMessage("");
    const response = await fetch("/api/settings/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        salaryExpectationMin: form.salaryExpectationMin ? parseInt(form.salaryExpectationMin, 10) : null,
        salaryExpectationMax: form.salaryExpectationMax ? parseInt(form.salaryExpectationMax, 10) : null,
        salaryExpectationPreferredText: form.salaryExpectationPreferredText || null,
        salaryExpectationNet: form.salaryExpectationNet
      })
    });
    const data = await response.json();
    setBusy(false);
    setMessage(data.message);
  }

  return (
    <Card className="grid gap-5">
      <div>
        <h2 className="text-xl font-semibold tracking-normal">Зарплатные ожидания</h2>
        <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
          Если работодатель просит указать зарплатные ожидания, CareerOS использует эту формулировку в сопроводительном письме.
          Если поле пустое — AI не будет придумывать сумму.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Минимум, ₽">
          <input
            className={inputClass}
            type="number"
            min={0}
            step={1000}
            value={form.salaryExpectationMin}
            onChange={(e) => setForm((f) => ({ ...f, salaryExpectationMin: e.target.value }))}
            placeholder="например 150000"
          />
        </Field>
        <Field label="Максимум, ₽">
          <input
            className={inputClass}
            type="number"
            min={0}
            step={1000}
            value={form.salaryExpectationMax}
            onChange={(e) => setForm((f) => ({ ...f, salaryExpectationMax: e.target.value }))}
            placeholder="например 270000"
          />
        </Field>
      </div>

      <Field label="Формулировка для сопроводительных писем">
        <textarea
          className={`${inputClass} min-h-[80px] resize-y`}
          value={form.salaryExpectationPreferredText}
          onChange={(e) => setForm((f) => ({ ...f, salaryExpectationPreferredText: e.target.value }))}
          placeholder="рассматриваю предложения от 150–200 тыс. ₽ после вычета налогов"
        />
      </Field>

      <label className="flex cursor-pointer items-center gap-3">
        <input
          type="checkbox"
          className="h-4 w-4 rounded border border-[var(--line)]"
          checked={form.salaryExpectationNet}
          onChange={(e) => setForm((f) => ({ ...f, salaryExpectationNet: e.target.checked }))}
        />
        <span className="text-sm">После вычета налогов (net)</span>
      </label>

      <Button onClick={save} disabled={busy}>
        {busy ? "Сохраняем..." : "Сохранить"}
      </Button>

      {message ? (
        <p className="rounded-md border border-[var(--line)] bg-[var(--panel)] p-3 text-sm">{message}</p>
      ) : null}
    </Card>
  );
}
