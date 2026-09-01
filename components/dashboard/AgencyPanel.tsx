"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { COUNTRIES } from "@/lib/countries";
import { useStore } from "@/lib/store";
import { useI18n } from "@/lib/i18n/context";
import { Field, Modal, ModalActions, fieldCls } from "./Modal";
import * as sb from "@/lib/supabase/actions";

/**
 * Which business the dashboard is showing, and how to start another one.
 *
 * This lives on the settings page rather than in the sidebar. The sidebar is
 * for moving around one agency, and a second menu at the top of it read as a
 * navigation tab rather than as a choice of company. Settings is already where
 * the agency's name, currency and team are, so the agency it applies to
 * belongs on the same page.
 *
 * Switching goes through the server rather than through local state: the
 * portfolio is read on the server and decides what to load from the same
 * cookie this sets, so a refresh is the switch rather than a consequence of it.
 */
export function AgencyPanel() {
  const { agencies, agencyInfo, agencyId } = useStore();
  const { t, locale } = useI18n();
  const router = useRouter();
  const a = t.dash.settings.agencies;

  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [switching, setSwitching] = useState<string>();
  const [error, setError] = useState<string>();

  // Nothing to show before the portfolio has loaded. One agency still shows the
  // card, because that is where the button to create the second one is.
  if (!agencyInfo?.name) return null;

  const switchTo = async (id: string) => {
    if (id === agencyId) return;
    setSwitching(id);
    // The building choice belongs to the agency that was open, and a building
    // id from one agency means nothing in another.
    try {
      localStorage.removeItem("charta-building");
    } catch {
      /* storage unavailable, the provider falls back to the first building */
    }
    await sb.selectAgency(locale, id);
    router.refresh();
    setSwitching(undefined);
  };

  return (
    <>
      <p className="-mt-3 mb-5 text-sm text-onyx/50 dark:text-white/45">{a.note}</p>

      <div className="space-y-2">
        {agencies.map((agency) => {
          const active = agency.id === agencyId;
          return (
            <div
              key={agency.id}
              className={`flex items-center gap-3 rounded-2xl border px-4 py-3 transition ${
                active
                  ? "border-transparent bg-onyx text-white dark:bg-soft-500 dark:text-azure-950"
                  : "border-azure-900/10 bg-white/50 dark:border-white/10 dark:bg-white/[0.04]"
              }`}
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold">{agency.name}</span>
                <span
                  className={`block truncate text-xs ${
                    active ? "opacity-70" : "text-onyx/45 dark:text-white/40"
                  }`}
                >
                  {agency.city}
                </span>
              </span>
              {active ? (
                <span className="shrink-0 text-[11px] font-semibold uppercase tracking-wider opacity-70">
                  {a.current}
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => switchTo(agency.id)}
                  disabled={Boolean(switching)}
                  className="shrink-0 rounded-full border border-azure-900/15 px-4 py-2 text-xs font-semibold text-azure-800 transition hover:bg-azure-900/5 disabled:opacity-40 dark:border-white/15 dark:text-white dark:hover:bg-white/10"
                >
                  {switching === agency.id ? t.dash.common.saving : a.switchTo}
                </button>
              )}
            </div>
          );
        })}

        <button
          type="button"
          onClick={() => {
            setError(undefined);
            setAdding(true);
          }}
          className="flex w-full items-center gap-3 rounded-2xl border border-dashed border-azure-900/20 px-4 py-3 text-left transition hover:bg-azure-900/5 dark:border-white/20 dark:hover:bg-white/[0.06]"
        >
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-azure-900/20 text-azure-800 dark:border-white/25 dark:text-soft-500">
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </span>
          <span className="text-sm font-bold text-azure-950 dark:text-white">{a.add}</span>
        </button>
      </div>

      {adding && (
        <Modal title={a.add} subtitle={a.addSubtitle} onClose={() => setAdding(false)}>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const data = new FormData(e.currentTarget);
              const agencyName = String(data.get("name") ?? "").trim();
              if (!agencyName) {
                setError(t.dash.common.required);
                return;
              }
              setSaving(true);
              const result = await sb.createAgency(locale, {
                name: agencyName,
                country: String(data.get("country") ?? "Guinea"),
                city: String(data.get("city") ?? ""),
                currency: String(data.get("currency") ?? "GNF"),
              });
              setSaving(false);
              if (!result.ok) {
                setError(result.error);
                return;
              }
              // The new agency has no buildings, so the old choice must go with
              // the old agency or the dashboard opens on somebody else's.
              try {
                localStorage.removeItem("charta-building");
              } catch {
                /* ignore */
              }
              setAdding(false);
              router.refresh();
            }}
            className="space-y-4"
          >
            <Field label={t.dash.settings.agencyName} error={error}>
              <input name="name" placeholder={a.addPlaceholder} className={fieldCls} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t.dash.settings.country}>
                <select name="country" defaultValue={agencyInfo?.country ?? "Guinea"} className={fieldCls}>
                  {COUNTRIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </Field>
              <Field label={t.dash.settings.city}>
                <input name="city" defaultValue="" className={fieldCls} />
              </Field>
            </div>
            <Field label={t.dash.settings.currency} hint={a.addHint} hintAfter>
              <select name="currency" defaultValue={agencyInfo?.currency ?? "GNF"} className={fieldCls}>
                <option value="GNF">GNF · Franc guinéen</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="XOF">XOF · Franc CFA (UEMOA)</option>
                <option value="XAF">XAF · Franc CFA (CEMAC)</option>
              </select>
            </Field>
            <ModalActions
              onCancel={() => setAdding(false)}
              submitLabel={saving ? t.dash.common.saving : a.addSubmit}
            />
          </form>
        </Modal>
      )}
    </>
  );
}
