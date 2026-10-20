"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";

import { useBuilding } from "@/lib/building-context";
import type { LeaseCycle } from "@/lib/data";
import { useStore } from "@/lib/store";
import { useMoney } from "@/lib/money";
import { useI18n } from "@/lib/i18n/context";
import { Card, CardTitle, PageTitle, PhotoPlaceholder, ProgressBar, RentChip } from "@/components/dashboard/ui";
import { Field, Modal, ModalActions, fieldCls } from "@/components/dashboard/Modal";
import { MultiPhotoPicker } from "@/components/dashboard/PhotoPicker";
import { BuildingPhoto } from "@/components/dashboard/BuildingPhoto";

type Filter = "all" | "occupied" | "vacant" | "overdue";

function AddApartmentModal({ onClose }: { onClose: () => void }) {
  const { t, f } = useI18n();
  const { building } = useBuilding();
  const { addApartment, notify } = useStore();
  const m = t.dash.apartments.addModal;
  const [letting, setLetting] = useState<"monthly" | "nightly">("monthly");
  const [error, setError] = useState<string>();
  const [photos, setPhotos] = useState<string[]>([]);

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const label = String(data.get("label") ?? "").trim();
    if (!label) {
      setError(t.dash.common.required);
      return;
    }
    addApartment(building.id, {
      shortStay: letting === "nightly",
      label,
      rooms: Number(data.get("rooms") ?? 2),
      bathrooms: Number(data.get("bathrooms") ?? 1),
      sqm: Number(data.get("sqm") ?? 60),
      rent: Number(data.get("rent") ?? 800),
      // The asking price. A tenancy sets its own rent and its own cycle.
      cycle: "monthly",
      photos,
    });
    notify(`${label} · ${m.submit}`);
    onClose();
  };

  return (
    <Modal title={m.title} subtitle={f(m.subtitle, { building: building.name })} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        {/* How it is let, because the two are priced in different places: a
            monthly rent here, a nightly band on the unit's own page. */}
        <Field label={m.letting} hint={letting === "nightly" ? m.nightlyHint : m.lettingHint} hintAfter>
          <div role="radiogroup" aria-label={m.letting} className="flex gap-2">
            {([["monthly", m.monthlyLet], ["nightly", m.nightlyLet]] as const).map(([key, label]) => (
              <button
                key={key}
                type="button"
                role="radio"
                aria-checked={letting === key}
                onClick={() => setLetting(key)}
                className={`flex-1 rounded-2xl border px-4 py-2.5 text-sm font-semibold transition ${
                  letting === key
                    ? "border-azure-950 bg-azure-950 text-white dark:border-soft-500 dark:bg-soft-500 dark:text-azure-950"
                    : "border-azure-900/15 text-onyx/60 hover:bg-azure-900/5 dark:border-white/15 dark:text-white/60 dark:hover:bg-white/10"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </Field>

        <Field label={m.label} error={error}>
          <input name="label" placeholder={m.labelPlaceholder} className={fieldCls} />
        </Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label={m.rooms}>
            <input name="rooms" type="number" min={1} defaultValue={2} className={fieldCls} />
          </Field>
          <Field label={m.bathrooms}>
            <input name="bathrooms" type="number" min={1} defaultValue={1} className={fieldCls} />
          </Field>
          <Field label={m.sqm}>
            <input name="sqm" type="number" min={10} defaultValue={60} className={fieldCls} />
          </Field>
        </div>
        {/* No cycle here. How often rent falls due is a term of a tenancy,
            not a property of a room, and it is agreed with whoever signs. The
            field that used to sit beside this one was never saved: apartments
            has no such column, so the choice vanished on the next refresh. */}
        {letting === "monthly" && (
        <Field label={m.rent} hint={m.rentHint} hintAfter>
          <input name="rent" type="number" min={0} step={50} defaultValue={800} className={fieldCls} />
        </Field>
        )}
        <Field plain label={m.photos} hint={m.photosHint}>
          <MultiPhotoPicker
            value={photos}
            onChange={setPhotos}
            uploadLabel={t.dash.gallery.addModal.upload}
            emptyLabel={m.photosEmpty}
            removeLabel={m.photosRemove}
            coverLabel={m.photosCover}
          />
        </Field>
        <ModalActions onCancel={onClose} submitLabel={m.submit} />
      </form>
    </Modal>
  );
}

export default function ApartmentsPage() {
  const { building } = useBuilding();
  const { t, f, path } = useI18n();
  const { fmt } = useMoney();
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [adding, setAdding] = useState(false);

  const occupied = building.apartments.filter((a) => a.tenant);
  const vacant = building.apartments.length - occupied.length;
  const overdue = building.apartments.filter((a) => a.rentStatus === "overdue" && a.tenant);
  const sqm = building.apartments.reduce((sum, a) => sum + a.sqm, 0);
  const rentRoll = occupied.reduce((sum, a) => sum + a.rent, 0);
  // A building with no units yet is every building on the day it is created,
  // and dividing by that count read "Loué à NaN%" on the screen it opens to.
  const pct = building.apartments.length
    ? Math.round((occupied.length / building.apartments.length) * 100)
    : 0;

  const rows = useMemo(
    () =>
      building.apartments.filter((a) => {
        const matches =
          filter === "all" ||
          (filter === "occupied" && a.tenant) ||
          (filter === "vacant" && !a.tenant) ||
          (filter === "overdue" && a.tenant && a.rentStatus === "overdue");
        const haystack = `${a.label} ${a.tenant?.name ?? ""}`.toLowerCase();
        return matches && haystack.includes(search.toLowerCase());
      }),
    [building, filter, search]
  );

  const tabs: { key: Filter; label: string; count: number }[] = [
    { key: "all", label: t.dash.apartments.filters.all, count: building.apartments.length },
    { key: "occupied", label: t.dash.apartments.filters.occupied, count: occupied.length },
    { key: "vacant", label: t.dash.apartments.filters.vacant, count: vacant },
    { key: "overdue", label: t.dash.apartments.filters.overdue, count: overdue.length },
  ];

  return (
    <>
      <PageTitle
        title={t.dash.apartments.title}
        subtitle={f(t.dash.apartments.subtitle, {
          building: building.name,
          city: building.city,
        })}
        action={
          <button
            onClick={() => setAdding(true)}
            className="rounded-full bg-onyx px-6 py-3 text-sm font-semibold text-white transition hover:bg-azure-900 dark:bg-soft-500 dark:text-azure-950 dark:hover:bg-soft-400"
          >
            {t.dash.apartments.addApartment}
          </button>
        }
      />

      <Card className="overflow-hidden p-0">
        <div className="grid gap-0 md:grid-cols-[1.1fr_1fr]">
          <div className="relative h-56 md:h-auto">
            <BuildingPhoto
              buildingId={building.id}
              photo={building.photo}
              name={building.name}
              className="absolute inset-0 h-full w-full"
            />
            <span className="absolute left-4 top-4 rounded-full bg-white/85 px-3.5 py-1.5 text-xs font-bold text-azure-950 backdrop-blur-sm">
              {building.netYield}% {t.dash.apartments.netYield}
            </span>
          </div>
          <div className="p-6">
            <h2 className="font-serif text-2xl font-medium text-azure-950 dark:text-white">
              {building.name}
            </h2>
            <p className="mt-1 flex items-center gap-1.5 text-sm text-onyx/50 dark:text-white/45">
              <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-azure-600 dark:text-soft-500" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 1118 0z" /><circle cx="12" cy="10" r="3" />
              </svg>
              {building.address}, {building.city}
            </p>

            <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
              {[
                [String(building.apartments.length), t.dash.apartments.filters.all],
                [String(occupied.length), t.dash.status.occupied],
                [String(vacant), t.dash.status.vacant],
                [String(sqm), t.dash.common.sqm],
              ].map(([v, l]) => (
                <div key={l}>
                  <p className="text-2xl font-extrabold text-azure-950 dark:text-white">{v}</p>
                  <p className="text-[11px] text-onyx/45 dark:text-white/40">{l}</p>
                </div>
              ))}
            </div>

            <ProgressBar pct={pct} className="mt-5" />
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-onyx/45 dark:text-white/40">
              <span>{f(t.dash.apartments.leasedAt, { pct })}</span>
              <span>{f(t.dash.apartments.rentRoll, { amount: fmt(rentRoll) })}</span>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              {building.amenities.map((a) => (
                <span
                  key={a}
                  className="rounded-full border border-white/70 bg-white/50 px-3 py-1 text-xs font-semibold text-onyx/60 backdrop-blur-xl dark:border-white/10 dark:bg-white/5 dark:text-white/60"
                >
                  {a}
                </span>
              ))}
            </div>
          </div>
        </div>
      </Card>

      {/* filters */}
      <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap gap-2">
          {tabs.map((tab) => {
            const active = filter === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setFilter(tab.key)}
                className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${
                  active
                    ? "bg-onyx text-white dark:bg-soft-500 dark:text-azure-950"
                    : "border border-white/70 bg-white/50 text-onyx/60 backdrop-blur-xl hover:bg-white/70 dark:border-white/10 dark:bg-white/5 dark:text-white/60 dark:hover:bg-white/10"
                }`}
              >
                {tab.label}
                <span className={`text-xs ${active ? "opacity-70" : "opacity-50"}`}>{tab.count}</span>
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-2.5 rounded-2xl border border-white/70 bg-white/60 px-4 py-2.5 backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
          <svg viewBox="0 0 24 24" className="h-4 w-4 text-onyx/35 dark:text-white/35" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" />
          </svg>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t.dash.apartments.search}
            className="w-52 bg-transparent text-sm text-azure-950 outline-none placeholder:text-onyx/35 dark:text-white dark:placeholder:text-white/35"
          />
        </div>
      </div>

      <Card className="mt-6">
        <CardTitle>
          {rows.length}{" "}
          {rows.length === 1 ? t.dash.apartments.countOne : t.dash.apartments.countMany}
        </CardTitle>
        {rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-onyx/45 dark:text-white/45">
            {t.dash.apartments.empty}
          </p>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {rows.map((a) => (
              <Link
                key={a.id}
                href={path(`/dashboard/apartments/${a.id}`)}
                className="group/unit block rounded-2xl border border-white/70 bg-white/40 p-3 backdrop-blur-xl transition hover:bg-white/70 dark:border-white/10 dark:bg-white/[0.04] dark:hover:bg-white/[0.08]"
              >
                <div className="relative h-36 overflow-hidden rounded-xl">
                  {/* The unit's own first photo, a placeholder until it has one. */}
                  {a.photos?.[0]?.src ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={a.photos[0].src}
                      alt={a.label}
                      className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover/unit:scale-105"
                    />
                  ) : (
                    <PhotoPlaceholder className="absolute inset-0 h-full w-full" />
                  )}
                  <span
                    className={`absolute left-3 top-3 rounded-full px-3 py-1 text-[11px] font-bold backdrop-blur-sm ${
                      !a.tenant
                        ? "bg-white/90 text-azure-950"
                        : a.rentStatus === "overdue"
                          ? "bg-onyx/85 text-white"
                          : "bg-azure-800/85 text-white"
                    }`}
                  >
                    {!a.tenant
                      ? t.dash.status.toLet
                      : a.rentStatus === "overdue"
                        ? t.dash.status.overdue
                        : t.dash.status.occupied}
                  </span>
                </div>
                <div className="mt-3 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-azure-950 group-hover/unit:text-azure-600 dark:text-white dark:group-hover/unit:text-soft-500">
                      {a.label}
                    </p>
                    <p className="truncate text-xs text-onyx/45 dark:text-white/40">
                      {a.tenant ? a.tenant.name : t.dash.apartments.vacantLabel} · {a.rooms}{" "}
                      {a.rooms === 1 ? t.dash.common.room : t.dash.common.rooms} · {a.sqm} m²
                    </p>
                  </div>
                  <p className="shrink-0 text-sm font-extrabold text-azure-950 dark:text-white">
                    {fmt(a.rent)}
                    <span className="text-xs font-medium text-onyx/40 dark:text-white/40">
                      {" "}
                      /{t.dash.common.month.slice(0, 1)}
                    </span>
                  </p>
                </div>
                {a.tenant && (
                  <div className="mt-3">
                    <RentChip status={a.rentStatus} />
                  </div>
                )}
              </Link>
            ))}
          </div>
        )}
      </Card>

      {adding && <AddApartmentModal onClose={() => setAdding(false)} />}
    </>
  );
}
