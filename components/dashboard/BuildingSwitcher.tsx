"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

import { useBuildingOptional } from "@/lib/building-context";
import { useStore } from "@/lib/store";
import { useI18n } from "@/lib/i18n/context";
import { useMoney } from "@/lib/money";
import { Field, Modal, ModalActions, fieldCls } from "./Modal";
import { PhotoPlaceholder } from "./ui";

export function BuildingSwitcher({ align = "left" }: { align?: "left" | "right" }) {
  const { building, setBuildingId, buildings } = useBuildingOptional();
  const { addBuilding, notify } = useStore();
  const { t, f } = useI18n();
  const { fmt } = useMoney();
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

  if (!building) return null;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex items-center gap-3 rounded-2xl border border-white/70 bg-white/60 py-1.5 pl-1.5 pr-3 backdrop-blur-xl transition hover:bg-white/80 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
      >
        {building.photo ? (
          <Image
            src={building.photo}
            alt=""
            width={80}
            height={80}
            className="h-9 w-9 shrink-0 rounded-xl object-cover"
          />
        ) : (
          <PhotoPlaceholder icon="building" className="h-9 w-9 shrink-0 rounded-xl" />
        )}
        <span className="hidden text-left sm:block">
          <span className="block max-w-[11rem] truncate text-sm font-bold leading-tight text-azure-950 dark:text-white">
            {building.name}
          </span>
          <span className="block text-[11px] leading-tight text-onyx/45 dark:text-white/40">
            {building.city} · {building.apartments.length} {t.dash.shell.apartmentsCount}
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
          className={`absolute ${align === "right" ? "right-0" : "left-0"} z-50 mt-2 w-80 overflow-hidden rounded-3xl border border-white/70 bg-white/80 p-2 shadow-2xl shadow-azure-900/15 backdrop-blur-2xl dark:border-white/10 dark:bg-onyx/85`}
        >
          <p className="px-3 pb-1.5 pt-2 text-[11px] font-semibold uppercase tracking-wider text-onyx/40 dark:text-white/35">
            {t.dash.shell.switchBuilding}
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
                    ? "bg-onyx text-white dark:bg-soft-500 dark:text-azure-950"
                    : "hover:bg-azure-900/5 dark:hover:bg-white/10"
                }`}
              >
                {b.photo ? (
                  <Image
                    src={b.photo}
                    alt=""
                    width={96}
                    height={96}
                    className="h-11 w-11 shrink-0 rounded-xl object-cover"
                  />
                ) : (
                  <PhotoPlaceholder icon="building" className="h-11 w-11 shrink-0 rounded-xl" />
                )}
                <span className="min-w-0 flex-1">
                  <span className={`block truncate text-sm font-bold ${active ? "" : "text-azure-950 dark:text-white"}`}>
                    {b.name}
                  </span>
                  <span className={`block truncate text-xs ${active ? "opacity-70" : "text-onyx/45 dark:text-white/40"}`}>
                    {occ}/{b.apartments.length} {t.dash.shell.occupiedShort} · {fmt(b.incomeYtd)}
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
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-dashed border-azure-900/25 text-azure-800 dark:border-white/25 dark:text-soft-500">
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 5v14M5 12h14" />
                </svg>
              </span>
              <span className="text-sm font-bold text-azure-950 dark:text-white">
                {t.dash.shell.addBuilding}
              </span>
            </button>
          </div>
        </div>
      )}

      {adding && (
        <Modal
          title={t.dash.shell.addBuilding}
          subtitle={t.dash.shell.addBuildingSubtitle}
          onClose={() => setAdding(false)}
        >
          <form
            onSubmit={async (e) => {
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
              if (!id) return;
              // The rest of the dashboard moves to the new building, which is
              // where whoever just created it is going next.
              setBuildingId(id);
              notify(f(t.dash.onboarding.created, { name }));
              setAdding(false);
            }}
            className="space-y-4"
          >
            <Field label={t.dash.onboarding.name} error={error}>
              <input name="name" placeholder={t.dash.onboarding.namePlaceholder} className={fieldCls} />
            </Field>
            <Field label={t.dash.onboarding.address}>
              <input name="address" placeholder={t.dash.onboarding.addressPlaceholder} className={fieldCls} />
            </Field>
            <Field label={t.dash.onboarding.city}>
              <input name="city" defaultValue={building.city} className={fieldCls} />
            </Field>
            <ModalActions
              onCancel={() => setAdding(false)}
              submitLabel={saving ? t.dash.common.saving : t.dash.onboarding.submit}
            />
          </form>
        </Modal>
      )}
    </div>
  );
}
