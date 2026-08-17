"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { fmt } from "@/lib/data";
import { useBuilding } from "@/lib/building-context";
import { useI18n } from "@/lib/i18n/context";

export function BuildingSwitcher({ align = "left" }: { align?: "left" | "right" }) {
  const { building, setBuildingId, buildings } = useBuilding();
  const { t, s: ts } = useI18n();
  const [open, setOpen] = useState(false);
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

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex items-center gap-3 rounded-2xl border border-white/70 bg-white/60 py-1.5 pl-1.5 pr-3 backdrop-blur-xl transition hover:bg-white/80 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
      >
        <Image
          src={building.photo}
          alt=""
          width={80}
          height={80}
          className="h-9 w-9 shrink-0 rounded-xl object-cover"
        />
        <span className="hidden text-left sm:block">
          <span className="block max-w-[11rem] truncate text-sm font-bold leading-tight text-azure-950 dark:text-white">
            {building.name}
          </span>
          <span className="block text-[11px] leading-tight text-onyx/45 dark:text-white/40">
            {ts("cities", building.city)} · {building.apartments.length} {t.dash.shell.apartmentsCount}
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
                <Image
                  src={b.photo}
                  alt=""
                  width={96}
                  height={96}
                  className="h-11 w-11 shrink-0 rounded-xl object-cover"
                />
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
        </div>
      )}
    </div>
  );
}
