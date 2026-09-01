"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { useBuildingOptional } from "@/lib/building-context";
import { COUNTRIES } from "@/lib/countries";
import { useI18n } from "@/lib/i18n/context";
import { useMoney } from "@/lib/money";
import { useStore } from "@/lib/store";
import { AddBuildingModal } from "./AddBuildingModal";
import { Field, Modal, ModalActions, fieldCls } from "./Modal";
import { PhotoPlaceholder } from "./ui";
import * as sb from "@/lib/supabase/actions";

/**
 * The one chip in the top bar, and it changes the agency.
 *
 * There were briefly two of these side by side, one for the agency and one for
 * the building, and at a glance they read as the same control repeated rather
 * than as a business and a property inside it. So there is one, it is named
 * after the business, and switching it changes the whole portfolio.
 *
 * The buildings of the open agency hang underneath, and only when there is
 * more than one. An agency with a single building has nothing to choose, and
 * an agency with three would otherwise have two of them unreachable.
 *
 * Switching the agency goes through the server rather than through local
 * state: the portfolio is read on the server and decides what to load from the
 * same cookie this sets, so a refresh is the switch rather than a consequence
 * of it. Switching the building is local, because every building is already in
 * hand once the agency is loaded.
 */
export function PortfolioSwitcher({ align = "left" }: { align?: "left" | "right" }) {
  const { building, setBuildingId, buildings } = useBuildingOptional();
  const { agencies, agencyInfo, agencyId } = useStore();
  const { t, locale } = useI18n();
  const { fmt } = useMoney();
  const router = useRouter();
  const sh = t.dash.shell;

  const [open, setOpen] = useState(false);
  const [addingBuilding, setAddingBuilding] = useState(false);
  const [addingAgency, setAddingAgency] = useState(false);
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

  const switchAgency = async (id: string) => {
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

  const subtitle = [
    agencyInfo?.city,
    `${buildings.length} ${buildings.length === 1 ? sh.buildingsCountOne : sh.buildingsCount}`,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex items-center gap-3 rounded-2xl border border-white/70 bg-white/60 py-1.5 pl-1.5 pr-3 backdrop-blur-xl transition hover:bg-white/80 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
      >
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-azure-900/8 text-azure-800 dark:bg-white/10 dark:text-soft-500">
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 21h18M6 21V6a2 2 0 012-2h8a2 2 0 012 2v15M10 8h1M13 8h1M10 12h1M13 12h1M10 16h4v5h-4z" />
          </svg>
        </span>
        <span className="hidden text-left sm:block">
          <span className="block max-w-[11rem] truncate text-sm font-bold leading-tight text-azure-950 dark:text-white">
            {name}
          </span>
          <span className="block text-[11px] leading-tight text-onyx/45 dark:text-white/40">
            {subtitle}
          </span>
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
          // Carrying two lists makes this panel tall enough to sit over the
          // figures on the page, and at 80% the numbers behind it showed
          // through the rows. Glass still, but opaque enough to read.
          className={`absolute ${align === "right" ? "right-0" : "left-0"} z-50 mt-2 max-h-[75vh] w-80 overflow-y-auto rounded-3xl border border-white/70 bg-white/95 p-2 shadow-2xl shadow-azure-900/15 backdrop-blur-2xl dark:border-white/10 dark:bg-onyx/95`}
        >
          <p className="px-3 pb-1.5 pt-2 text-[11px] font-semibold uppercase tracking-wider text-onyx/40 dark:text-white/35">
            {sh.switchAgency}
          </p>
          {agencies.map((agency) => {
            const active = agency.id === agencyId;
            return (
              <button
                key={agency.id}
                role="option"
                aria-selected={active}
                onClick={() => switchAgency(agency.id)}
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

          <button
            onClick={() => {
              setOpen(false);
              setError(undefined);
              setAddingAgency(true);
            }}
            className="flex w-full items-center gap-3 rounded-2xl p-2.5 text-left transition hover:bg-azure-900/5 dark:hover:bg-white/10"
          >
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl border border-dashed border-azure-900/25 text-azure-800 dark:border-white/25 dark:text-soft-500">
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 5v14M5 12h14" />
              </svg>
            </span>
            <span className="text-sm font-bold text-azure-950 dark:text-white">{sh.addAgency}</span>
          </button>

          {/* The buildings of the agency that is open. Hidden at one, where
              there is nothing to choose between. */}
          {building && buildings.length > 1 && (
            <div className="mt-1 border-t border-azure-900/10 pt-1 dark:border-white/10">
              <p className="px-3 pb-1.5 pt-2 text-[11px] font-semibold uppercase tracking-wider text-onyx/40 dark:text-white/35">
                {sh.switchBuilding}
              </p>
              {buildings.map((b) => {
                const active = b.id === building.id;
                const occ = b.apartments.filter((a) => a.tenant).length;
                return (
                  <button
                    key={b.id}
                    role="option"
                    aria-selected={active}
                    onClick={() => {
                      setBuildingId(b.id);
                      setOpen(false);
                    }}
                    className={`flex w-full items-center gap-3 rounded-2xl p-2.5 text-left transition ${
                      active
                        ? "bg-azure-900/8 dark:bg-white/10"
                        : "hover:bg-azure-900/5 dark:hover:bg-white/10"
                    }`}
                  >
                    {b.photo ? (
                      <Image
                        src={b.photo}
                        alt=""
                        width={96}
                        height={96}
                        className="h-9 w-9 shrink-0 rounded-xl object-cover"
                      />
                    ) : (
                      <PhotoPlaceholder icon="building" className="h-9 w-9 shrink-0 rounded-xl" />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold text-azure-950 dark:text-white">
                        {b.name}
                      </span>
                      <span className="block truncate text-xs text-onyx/45 dark:text-white/40">
                        {occ}/{b.apartments.length} {sh.occupiedShort} · {fmt(b.incomeYtd)}
                      </span>
                    </span>
                    {active && (
                      <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-azure-800 dark:text-soft-500" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 6L9 17l-5-5" />
                      </svg>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          <div className={buildings.length > 1 ? "" : "mt-1 border-t border-azure-900/10 pt-1 dark:border-white/10"}>
            <button
              onClick={() => {
                setOpen(false);
                setAddingBuilding(true);
              }}
              className="flex w-full items-center gap-3 rounded-2xl p-2.5 text-left transition hover:bg-azure-900/5 dark:hover:bg-white/10"
            >
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl border border-dashed border-azure-900/25 text-azure-800 dark:border-white/25 dark:text-soft-500">
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 5v14M5 12h14" />
                </svg>
              </span>
              <span className="text-sm font-bold text-azure-950 dark:text-white">{sh.addBuilding}</span>
            </button>
          </div>
        </div>
      )}

      {addingBuilding && <AddBuildingModal onClose={() => setAddingBuilding(false)} />}

      {addingAgency && (
        <Modal title={sh.addAgency} subtitle={sh.addAgencySubtitle} onClose={() => setAddingAgency(false)}>
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
              setAddingAgency(false);
              router.refresh();
            }}
            className="space-y-4"
          >
            <Field label={t.dash.settings.agencyName} error={error}>
              <input name="name" placeholder={sh.addAgencyPlaceholder} className={fieldCls} />
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
                  business is at a different address, and a copied one is there
                  to be overtyped rather than to be true. */}
              <Field label={t.dash.settings.city}>
                <input name="city" defaultValue="" className={fieldCls} />
              </Field>
            </div>
            <Field label={t.dash.settings.currency} hint={sh.addAgencyHint} hintAfter>
              <select name="currency" defaultValue={agencyInfo?.currency ?? "GNF"} className={fieldCls}>
                <option value="GNF">GNF · Franc guinéen</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="XOF">XOF · Franc CFA (UEMOA)</option>
                <option value="XAF">XAF · Franc CFA (CEMAC)</option>
              </select>
            </Field>
            <ModalActions
              onCancel={() => setAddingAgency(false)}
              submitLabel={saving ? t.dash.common.saving : sh.addAgencySubmit}
            />
          </form>
        </Modal>
      )}
    </div>
  );
}
