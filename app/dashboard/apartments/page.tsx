"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { fmt } from "@/lib/data";
import { useBuilding } from "@/lib/building-context";
import { Card, CardTitle, PageTitle, ProgressBar, RentChip } from "@/components/dashboard/ui";

const UNIT_PHOTOS = [
  "/photos/interior-2.jpg",
  "/photos/interior-3.jpg",
  "/photos/interior-4.jpg",
  "/photos/interior-1.jpg",
];

type Filter = "all" | "occupied" | "vacant" | "overdue";

export default function ApartmentsPage() {
  const { building } = useBuilding();
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");

  const occupied = building.apartments.filter((a) => a.tenant);
  const vacant = building.apartments.length - occupied.length;
  const overdue = building.apartments.filter((a) => a.rentStatus === "overdue" && a.tenant);
  const sqm = building.apartments.reduce((s, a) => s + a.sqm, 0);
  const rentRoll = occupied.reduce((s, a) => s + a.rent, 0);

  const rows = useMemo(
    () =>
      building.apartments.filter((a) => {
        const matchesFilter =
          filter === "all" ||
          (filter === "occupied" && a.tenant) ||
          (filter === "vacant" && !a.tenant) ||
          (filter === "overdue" && a.tenant && a.rentStatus === "overdue");
        const haystack = `${a.label} ${a.tenant?.name ?? ""}`.toLowerCase();
        return matchesFilter && haystack.includes(search.toLowerCase());
      }),
    [building, filter, search]
  );

  const tabs: { key: Filter; label: string; count: number }[] = [
    { key: "all", label: "All apartments", count: building.apartments.length },
    { key: "occupied", label: "Occupied", count: occupied.length },
    { key: "vacant", label: "Vacant", count: vacant },
    { key: "overdue", label: "Overdue", count: overdue.length },
  ];

  return (
    <>
      <PageTitle
        title="Apartments"
        subtitle={`Every unit in ${building.name}, ${building.city}.`}
        action={
          <button className="rounded-full bg-onyx px-6 py-3 text-sm font-semibold text-white transition hover:bg-azure-900 dark:bg-soft-500 dark:text-azure-950 dark:hover:bg-soft-400">
            Add apartment
          </button>
        }
      />

      {/* building summary */}
      <Card className="overflow-hidden p-0">
        <div className="grid gap-0 md:grid-cols-[1.1fr_1fr]">
          <div className="relative h-56 md:h-auto">
            <Image src={building.photo} alt={building.name} fill className="object-cover" />
            <span className="absolute left-4 top-4 rounded-full bg-white/85 px-3.5 py-1.5 text-xs font-bold text-azure-950 backdrop-blur-sm">
              {building.netYield}% net yield
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
                [String(building.apartments.length), "Apartments"],
                [String(occupied.length), "Occupied"],
                [String(vacant), "Vacant"],
                [`${sqm}`, "Sq. Mtrs"],
              ].map(([v, l]) => (
                <div key={l}>
                  <p className="text-2xl font-extrabold text-azure-950 dark:text-white">{v}</p>
                  <p className="text-[11px] text-onyx/45 dark:text-white/40">{l}</p>
                </div>
              ))}
            </div>

            <ProgressBar
              pct={(occupied.length / building.apartments.length) * 100}
              className="mt-5"
            />
            <div className="mt-2 flex items-center justify-between text-xs text-onyx/45 dark:text-white/40">
              <span>Leased at {Math.round((occupied.length / building.apartments.length) * 100)}%</span>
              <span>{fmt(rentRoll)} rent roll per month</span>
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
          {tabs.map((t) => {
            const active = filter === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setFilter(t.key)}
                className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${
                  active
                    ? "bg-onyx text-white dark:bg-soft-500 dark:text-azure-950"
                    : "border border-white/70 bg-white/50 text-onyx/60 backdrop-blur-xl hover:bg-white/70 dark:border-white/10 dark:bg-white/5 dark:text-white/60 dark:hover:bg-white/10"
                }`}
              >
                {t.label}
                <span className={`text-xs ${active ? "opacity-70" : "opacity-50"}`}>{t.count}</span>
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
            placeholder="Search apartments or tenants"
            className="w-52 bg-transparent text-sm text-azure-950 outline-none placeholder:text-onyx/35 dark:text-white dark:placeholder:text-white/35"
          />
        </div>
      </div>

      {/* apartment cards */}
      <Card className="mt-6">
        <CardTitle>
          {rows.length} {rows.length === 1 ? "apartment" : "apartments"}
        </CardTitle>
        {rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-onyx/45 dark:text-white/45">
            No apartments match these filters.
          </p>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {rows.map((a, i) => (
              <Link
                key={a.id}
                href={`/dashboard/apartments/${a.id}`}
                className="group/unit block rounded-2xl border border-white/70 bg-white/40 p-3 backdrop-blur-xl transition hover:bg-white/70 dark:border-white/10 dark:bg-white/[0.04] dark:hover:bg-white/[0.08]"
              >
                <div className="relative h-36 overflow-hidden rounded-xl">
                  <Image
                    src={UNIT_PHOTOS[i % UNIT_PHOTOS.length]}
                    alt={a.label}
                    fill
                    className="object-cover transition duration-500 group-hover/unit:scale-105"
                  />
                  <span
                    className={`absolute left-3 top-3 rounded-full px-3 py-1 text-[11px] font-bold backdrop-blur-sm ${
                      !a.tenant
                        ? "bg-white/90 text-azure-950"
                        : a.rentStatus === "overdue"
                          ? "bg-onyx/85 text-white"
                          : "bg-azure-800/85 text-white"
                    }`}
                  >
                    {!a.tenant ? "To let" : a.rentStatus === "overdue" ? "Overdue" : "Occupied"}
                  </span>
                </div>
                <div className="mt-3 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-azure-950 group-hover/unit:text-azure-600 dark:text-white dark:group-hover/unit:text-soft-500">
                      {a.label}
                    </p>
                    <p className="truncate text-xs text-onyx/45 dark:text-white/40">
                      {a.tenant ? a.tenant.name : "Vacant"} · {a.rooms} {a.rooms === 1 ? "room" : "rooms"} · {a.sqm} m²
                    </p>
                  </div>
                  <p className="shrink-0 text-sm font-extrabold text-azure-950 dark:text-white">
                    {fmt(a.rent)}
                    <span className="text-xs font-medium text-onyx/40 dark:text-white/40"> /m</span>
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
    </>
  );
}
