"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { useI18n } from "@/lib/i18n/context";
import { Card } from "./ui";
import { Field, fieldCls } from "./Modal";

/**
 * Shown instead of the dashboard when the signed in agency has no building
 * yet, which is the state of every fresh signup. Nothing else in the product
 * is reachable until this exists, since apartments, leases and tickets all
 * hang off a building.
 */
export function FirstBuilding() {
  const { t, f } = useI18n();
  const { addBuilding, notify } = useStore();
  const m = t.dash.onboarding;
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const name = String(data.get("name") ?? "").trim();
    const address = String(data.get("address") ?? "").trim();
    const city = String(data.get("city") ?? "").trim();
    if (!name) {
      setError(t.dash.common.required);
      return;
    }
    setSaving(true);
    const id = await addBuilding({ name, address, city });
    setSaving(false);
    if (id) notify(f(m.created, { name }));
  };

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-lg flex-col justify-center">
      <Card>
        <h1 className="font-serif text-2xl font-medium text-azure-950 dark:text-white">
          {m.title}
        </h1>
        <p className="mt-1.5 text-sm text-onyx/55 dark:text-white/50">{m.subtitle}</p>

        <form onSubmit={submit} className="mt-6 space-y-4">
          <Field label={m.name} error={error}>
            <input name="name" placeholder={m.namePlaceholder} className={fieldCls} />
          </Field>
          <Field label={m.address}>
            <input name="address" placeholder={m.addressPlaceholder} className={fieldCls} />
          </Field>
          <Field label={m.city}>
            <input name="city" defaultValue="Conakry" className={fieldCls} />
          </Field>
          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-full bg-onyx py-3 text-sm font-semibold text-white transition hover:bg-azure-900 disabled:opacity-60 dark:bg-soft-500 dark:text-azure-950 dark:hover:bg-soft-400"
          >
            {saving ? t.dash.common.saving : m.submit}
          </button>
        </form>
      </Card>
    </div>
  );
}
