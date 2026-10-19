"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n/context";
import { useMoney } from "@/lib/money";
import { useStore } from "@/lib/store";
import * as sb from "@/lib/supabase/actions";
import { Field, Modal, ModalActions, fieldCls } from "@/components/dashboard/Modal";
import type { Apartment } from "@/lib/data";

/**
 * What a unit costs by the night.
 *
 * The agency writes its own packages: one night, three nights, a week,
 * whatever it sells. Nothing is interpolated between them, because a price
 * the agency did not set is a price it cannot stand behind; a stay of four
 * nights is quoted by the person booking it, with the nearest package in
 * front of them.
 */
export function StayRatesCard({ apartment }: { apartment: Apartment }) {
  const { t, f } = useI18n();
  const { fmt } = useMoney();
  const s = t.dash.stays;
  const [editing, setEditing] = useState(false);

  const rates = [...apartment.shortStay.rates].sort((a, b) => a.nights - b.nights);

  return (
    <>
      <div className="mt-4">
        {rates.length === 0 ? (
          <p className="text-sm text-onyx/45 dark:text-white/45">{s.noRates}</p>
        ) : (
          <ul className="space-y-2">
            {rates.map((r) => (
              <li
                key={r.id}
                className="flex items-center justify-between gap-4 rounded-xl border border-azure-900/8 bg-white/50 px-4 py-2.5 dark:border-white/8 dark:bg-white/[0.04]"
              >
                <span className="text-sm font-semibold text-azure-950 dark:text-white">
                  {f(r.nights === 1 ? s.nightOne : s.nights, { count: r.nights })}
                </span>
                <span className="text-sm font-bold text-azure-950 dark:text-white">{fmt(r.price)}</span>
              </li>
            ))}
          </ul>
        )}
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="mt-4 w-full rounded-full border border-azure-900/15 py-2.5 text-sm font-semibold text-azure-800 transition hover:bg-azure-900/5 dark:border-white/15 dark:text-soft-500 dark:hover:bg-white/10"
        >
          {rates.length === 0 ? s.setRates : s.editRates}
        </button>
      </div>

      {editing && <RatesModal apartment={apartment} onClose={() => setEditing(false)} />}
    </>
  );
}

type Draft = { nights: string; price: string };

function RatesModal({ apartment, onClose }: { apartment: Apartment; onClose: () => void }) {
  const { t, locale } = useI18n();
  const { notify, agencyId } = useStore();
  const router = useRouter();
  const s = t.dash.stays;

  const existing = [...apartment.shortStay.rates].sort((a, b) => a.nights - b.nights);
  const [rows, setRows] = useState<Draft[]>(
    existing.length > 0
      ? existing.map((r) => ({ nights: String(r.nights), price: String(r.price) }))
      // The three durations most agencies start from. All editable, and a
      // row left blank is simply not a package.
      : [{ nights: "1", price: "" }, { nights: "3", price: "" }, { nights: "7", price: "" }]
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();

  const setRow = (i: number, patch: Partial<Draft>) =>
    setRows((list) => list.map((r, n) => (n === i ? { ...r, ...patch } : r)));

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const rates = rows
      .map((r) => ({ nights: Number(r.nights), price: Number(r.price) }))
      .filter((r) => r.nights >= 1 && r.price > 0);
    if (new Set(rates.map((r) => r.nights)).size !== rates.length) {
      setError(s.duplicateNights);
      return;
    }
    setSaving(true);
    setError(undefined);
    const result = await sb.setStayRates(locale, { agencyId, apartmentId: apartment.id, rates });
    setSaving(false);
    if (!result.ok) {
      setError(result.error === "stay-duplicate-nights" ? s.duplicateNights : t.dash.common.saveFailed);
      return;
    }
    notify(s.ratesSaved);
    onClose();
    router.refresh();
  };

  return (
    <Modal title={s.ratesTitle} subtitle={apartment.label} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <p className="text-xs leading-relaxed text-onyx/55 dark:text-white/50">{s.ratesHint}</p>

        <div className="space-y-2">
          {rows.map((row, i) => (
            <div key={i} className="flex items-end gap-2">
              <Field label={i === 0 ? s.nightsLabel : ""}>
                <input
                  type="number"
                  min={1}
                  max={365}
                  value={row.nights}
                  onChange={(e) => setRow(i, { nights: e.target.value })}
                  className={fieldCls}
                />
              </Field>
              <Field label={i === 0 ? s.priceLabel : ""}>
                <input
                  type="number"
                  min={0}
                  value={row.price}
                  onChange={(e) => setRow(i, { price: e.target.value })}
                  className={fieldCls}
                />
              </Field>
              <button
                type="button"
                onClick={() => setRows((list) => list.filter((_, n) => n !== i))}
                aria-label={s.removeRate}
                className="mb-1 grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-azure-900/15 text-onyx/45 transition hover:bg-azure-900/5 hover:text-azure-950 dark:border-white/15 dark:text-white/45 dark:hover:bg-white/10 dark:hover:text-white"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setRows((list) => [...list, { nights: "", price: "" }])}
          className="w-full rounded-2xl border border-dashed border-azure-900/20 py-2.5 text-sm font-semibold text-azure-800 transition hover:bg-azure-900/5 dark:border-white/20 dark:text-soft-500 dark:hover:bg-white/10"
        >
          {s.addRate}
        </button>

        {error && <p className="text-xs font-semibold text-red-600">{error}</p>}
        <ModalActions onCancel={onClose} submitLabel={saving ? t.dash.common.saving : t.dash.common.save} />
      </form>
    </Modal>
  );
}
