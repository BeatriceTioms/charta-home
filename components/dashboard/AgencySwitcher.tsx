"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { COUNTRIES } from "@/lib/countries";
import { useStore } from "@/lib/store";
import { useI18n } from "@/lib/i18n/context";
import { Field, Modal, ModalActions, fieldCls } from "./Modal";
import * as sb from "@/lib/supabase/actions";

/**
 * Which business the dashboard is showing.
 *
 * Sits in the top bar, before the building it contains, so the two chips read
 * in the order the things nest: agency, then building, then the flats on the
 * page below. This is the only place the agency is named and the only place it
 * is changed, which is why creating one is in the menu here rather than on a
 * page somebody would have to know to open.
 *
 * Switching goes through the server rather than through local state: the
 * portfolio is read on the server and decides what to load from the same
 * cookie this sets, so a refresh is the switch rather than a consequence of it.
 */
export function AgencySwitcher({ align = "left" }: { align?: "left" | "right" }) {
  const { agencies, agencyInfo, agencyId } = useStore();
  const { t, locale } = useI18n();
  const router = useRouter();
  const a = t.dash.shell;

  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const name = agencyInfo?.name;
  if (!name) return null;

  const switchTo = async (id: string) => {
    setOpen(false);
    if (id === agencyId) return;
    // The building choice belongs to the agency that was open, and a building
    // id from one agency means nothing in another.
    try {
      localStorage.removeItem("charta-building");
    } catch {
      /* storage unavailable, the provider falls back to the first building */
    }
    await sb.selectAgency(locale, id);
    router.refresh();
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={a.switchAgency}
        className="flex items-center gap-2 rounded-2xl border border-white/70 bg-white/60 py-2 pl-3 pr-2.5 backdrop-blur-xl transition hover:bg-white/80 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-azure-800 dark:text-soft-500" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 21h18M6 21V6a2 2 0 012-2h8a2 2 0 012 2v15M10 8h1M13 8h1M10 12h1M13 12h1M10 16h4v5h-4z" />
        </svg>
        <span className="hidden max-w-[9rem] truncate text-sm font-bold text-azure-950 sm:block dark:text-white">
          {name}
        </span>
        <svg
          viewBox="0 0 24 24"
          className={`h-4 w-4 shrink-0 text-onyx/40 transition dark:text-white/40 ${open ? "rotate-180" : ""}`}
          fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div
          role="listbox"
          className={`absolute ${align === "right" ? "right-0" : "left-0"} z-50 mt-2 w-72 overflow-hidden rounded-3xl border border-white/70 bg-white/80 p-2 shadow-2xl shadow-azure-900/15 backdrop-blur-2xl dark:border-white/10 dark:bg-onyx/85`}
        >
          <p className="px-3 pb-1.5 pt-2 text-[11px] font-semibold uppercase tracking-wider text-onyx/40 dark:text-white/35">
            {a.switchAgency}
          </p>
          {agencies.map((agency) => {
            const active = agency.id === agencyId;
            return (
              <button
                key={agency.id}
                role="option"
                aria-selected={active}
                onClick={() => switchTo(agency.id)}
                className={`flex w-full items-center gap-3 rounded-2xl p-2.5 text-left transition ${
                  active
                    ? "bg-onyx text-white dark:bg-soft-500 dark:text-azure-950"
                    : "hover:bg-azure-900/5 dark:hover:bg-white/10"
                }`}
              >
                <span className="min-w-0 flex-1">
                  <span className={`block truncate text-sm font-bold ${active ? "" : "text-azure-950 dark:text-white"}`}>
                    {agency.name}
                  </span>
                  <span className={`block truncate text-xs ${active ? "opacity-70" : "text-onyx/45 dark:text-white/40"}`}>
                    {agency.city}
                  </span>
                </span>
                {active && (
                  <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                )}
              </button>
            );
          })}

          <div className="mt-1 border-t border-azure-900/10 pt-1 dark:border-white/10">
            <button
              onClick={() => {
                setOpen(false);
                setError(undefined);
                setAdding(true);
              }}
              className="flex w-full items-center gap-3 rounded-2xl p-2.5 text-left transition hover:bg-azure-900/5 dark:hover:bg-white/10"
            >
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl border border-dashed border-azure-900/25 text-azure-800 dark:border-white/25 dark:text-soft-500">
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 5v14M5 12h14" />
                </svg>
              </span>
              <span className="text-sm font-bold text-azure-950 dark:text-white">{a.addAgency}</span>
            </button>
          </div>
        </div>
      )}

      {adding && (
        <Modal title={a.addAgency} subtitle={a.addAgencySubtitle} onClose={() => setAdding(false)}>
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
              <input name="name" placeholder={a.addAgencyPlaceholder} className={fieldCls} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t.dash.settings.country}>
                <select name="country" defaultValue={agencyInfo?.country ?? "Guinea"} className={fieldCls}>
                  {COUNTRIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </Field>
              {/* Not prefilled from the agency you were looking at. A second
                  business is a different address, and a copied one is there to
                  be overtyped rather than to be true. */}
              <Field label={t.dash.settings.city}>
                <input name="city" defaultValue="" className={fieldCls} />
              </Field>
            </div>
            <Field label={t.dash.settings.currency} hint={a.addAgencyHint} hintAfter>
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
              submitLabel={saving ? t.dash.common.saving : a.addAgencySubmit}
            />
          </form>
        </Modal>
      )}
    </div>
  );
}
