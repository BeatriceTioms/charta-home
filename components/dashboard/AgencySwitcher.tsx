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
 * Sits on the agency name in the sidebar, above the buildings, because that is
 * the order the things nest in: an agency holds buildings, a building holds
 * flats. Somebody running one agency sees a name and never a menu, which is
 * why the whole control disappears below two.
 *
 * Switching goes through the server rather than through local state: the
 * portfolio is read on the server and decides what to load from the same
 * cookie this sets, so a refresh is the switch rather than a consequence of it.
 */
export function AgencySwitcher({ collapsed }: { collapsed: boolean }) {
  const { agencies, agencyInfo, agencyId } = useStore();
  const { t, locale } = useI18n();
  const router = useRouter();

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
  if (collapsed || !name) return null;

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
    <div ref={ref} className="relative px-5 pb-1">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex w-full items-center gap-1.5 text-left"
      >
        <span className="truncate text-[13px] font-semibold text-azure-800 dark:text-soft-500">
          {name}
        </span>
        <svg
          viewBox="0 0 24 24"
          className={`h-3.5 w-3.5 shrink-0 text-onyx/35 transition dark:text-white/35 ${open ? "rotate-180" : ""}`}
          fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute left-3 right-3 z-50 mt-1.5 overflow-hidden rounded-2xl border border-white/70 bg-white/90 p-1.5 shadow-2xl shadow-azure-900/15 backdrop-blur-2xl dark:border-white/10 dark:bg-onyx/95"
        >
          <p className="px-2.5 pb-1 pt-1.5 text-[10px] font-semibold uppercase tracking-wider text-onyx/40 dark:text-white/35">
            {t.dash.shell.switchAgency}
          </p>
          {agencies.map((a) => {
            const active = a.id === agencyId;
            return (
              <button
                key={a.id}
                role="option"
                aria-selected={active}
                onClick={() => switchTo(a.id)}
                className={`flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left transition ${
                  active
                    ? "bg-onyx text-white dark:bg-soft-500 dark:text-azure-950"
                    : "hover:bg-azure-900/5 dark:hover:bg-white/10"
                }`}
              >
                <span className="min-w-0 flex-1">
                  <span className={`block truncate text-[13px] font-bold ${active ? "" : "text-azure-950 dark:text-white"}`}>
                    {a.name}
                  </span>
                  <span className={`block truncate text-[11px] ${active ? "opacity-70" : "text-onyx/45 dark:text-white/40"}`}>
                    {a.city}
                  </span>
                </span>
                {active && (
                  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
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
              className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left transition hover:bg-azure-900/5 dark:hover:bg-white/10"
            >
              <span className="grid h-5 w-5 shrink-0 place-items-center rounded-md border border-dashed border-azure-900/25 text-azure-800 dark:border-white/25 dark:text-soft-500">
                <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 5v14M5 12h14" />
                </svg>
              </span>
              <span className="text-[13px] font-bold text-azure-950 dark:text-white">
                {t.dash.shell.addAgency}
              </span>
            </button>
          </div>
        </div>
      )}

      {adding && (
        <Modal
          title={t.dash.shell.addAgency}
          subtitle={t.dash.shell.addAgencySubtitle}
          onClose={() => setAdding(false)}
        >
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
              <input name="name" placeholder={t.dash.shell.addAgencyPlaceholder} className={fieldCls} />
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
                <input name="city" defaultValue={agencyInfo?.city ?? ""} className={fieldCls} />
              </Field>
            </div>
            <Field label={t.dash.settings.currency} hint={t.dash.shell.addAgencyHint} hintAfter>
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
              submitLabel={saving ? t.dash.common.saving : t.dash.shell.addAgencySubmit}
            />
          </form>
        </Modal>
      )}
    </div>
  );
}
