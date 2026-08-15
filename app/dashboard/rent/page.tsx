"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { collections, fmt, type RentStatus } from "@/lib/data";
import { useBuilding } from "@/lib/building-context";
import { PageTitle, RentChip } from "@/components/dashboard/ui";
import { ReceiptModal, type ReceiptData } from "@/components/dashboard/ReceiptModal";

const selectCls =
  "rounded-2xl border border-white/70 bg-white/60 px-4 py-2.5 backdrop-blur-xl text-sm font-semibold text-azure-950 outline-none transition hover:bg-azure-900/5 dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:bg-white/10 dark:[&>option]:bg-onyx";

type Tab = "all" | RentStatus;

export default function RentPage() {
  const { building } = useBuilding();
  const [tab, setTab] = useState<Tab>("all");
  const [search, setSearch] = useState("");
  const [reminded, setReminded] = useState<string[]>([]);
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);

  const leased = building.apartments.filter((a) => a.tenant);
  const august = collections[collections.length - 1];
  const due = leased.reduce((s, a) => s + a.rent, 0);
  const collected = leased
    .filter((a) => a.rentStatus === "paid")
    .reduce((s, a) => s + a.rent, 0);

  const counts = {
    all: leased.length,
    paid: leased.filter((a) => a.rentStatus === "paid").length,
    pending: leased.filter((a) => a.rentStatus === "pending").length,
    overdue: leased.filter((a) => a.rentStatus === "overdue").length,
  };

  const rows = useMemo(
    () =>
      leased.filter(
        (a) =>
          (tab === "all" || a.rentStatus === tab) &&
          a.tenant!.name.toLowerCase().includes(search.toLowerCase())
      ),
    [leased, tab, search]
  );

  const tabs: { key: Tab; label: string }[] = [
    { key: "all", label: "All leases" },
    { key: "paid", label: "Paid" },
    { key: "pending", label: "Pending" },
    { key: "overdue", label: "Overdue" },
  ];

  return (
    <>
      <PageTitle
        title="Rent collection"
        subtitle={`${building.name} · August 2026 · ${fmt(collected)} collected of ${fmt(due)} due.`}
        action={
          <div className="flex items-center gap-3">
            <button className="flex items-center gap-2 rounded-full border border-azure-900/15 px-5 py-3 text-sm font-semibold text-azure-950 transition hover:bg-azure-900/5 dark:border-white/15 dark:text-white dark:hover:bg-white/10">
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 3v12M8 11l4 4 4-4M4 21h16" />
              </svg>
              Export
            </button>
            <button className="rounded-full bg-onyx px-6 py-3 text-sm font-semibold text-white transition hover:bg-azure-900 dark:bg-soft-500 dark:text-azure-950 dark:hover:bg-soft-400">
              Record a payment
            </button>
          </div>
        }
      />

      {/* tabs */}
      <div className="mb-6 flex gap-7 overflow-x-auto border-b border-azure-900/10 dark:border-white/10">
        {tabs.map((t) => {
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`-mb-px flex shrink-0 items-center gap-2 border-b-2 pb-3 text-[15px] font-semibold transition ${
                active
                  ? "border-azure-800 text-azure-950 dark:border-soft-500 dark:text-white"
                  : "border-transparent text-onyx/45 hover:text-azure-950 dark:text-white/45 dark:hover:text-white"
              }`}
            >
              {t.label}
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                  active
                    ? "bg-soft-500 text-azure-950"
                    : "bg-azure-900/8 text-onyx/50 dark:bg-white/10 dark:text-white/50"
                }`}
              >
                {counts[t.key]}
              </span>
            </button>
          );
        })}
      </div>

      {/* table card */}
      <div className="rounded-3xl border border-white/70 bg-white/55 shadow-lg shadow-azure-900/5 backdrop-blur-2xl dark:border-white/10 dark:bg-white/[0.05] dark:shadow-none">
        {/* card header */}
        <div className="flex flex-wrap items-center justify-between gap-4 p-6">
          <p className="text-lg font-bold text-azure-950 dark:text-white">
            Leases{" "}
            <span className="ml-1 text-sm font-medium text-onyx/40 dark:text-white/40">
              Total {rows.length}
            </span>
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2.5 rounded-2xl border border-white/70 bg-white/60 px-4 py-2.5 backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
              <svg viewBox="0 0 24 24" className="h-4 w-4 text-onyx/35 dark:text-white/35" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" />
              </svg>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search tenants"
                className="w-40 bg-transparent text-sm text-azure-950 outline-none placeholder:text-onyx/35 dark:text-white dark:placeholder:text-white/35"
              />
            </div>
            <button
              onClick={() => {
                setTab("all");
                setSearch("");
              }}
              className="flex items-center gap-2 rounded-2xl border border-white/70 bg-white/60 px-4 py-2.5 backdrop-blur-xl text-sm font-semibold text-azure-950 transition hover:bg-azure-900/5 dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:bg-white/10"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 12a9 9 0 109-9 9.75 9.75 0 00-6.74 2.74L3 8" />
                <path d="M3 3v5h5" />
              </svg>
              Reset
            </button>
          </div>
        </div>

        {/* table */}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[880px] text-left text-sm">
            <thead>
              <tr className="border-y border-white/60 bg-white/40 text-xs text-onyx/45 dark:border-white/8 dark:bg-white/[0.03] dark:text-white/40">
                <th className="px-6 py-3.5 font-semibold">Apartment</th>
                <th className="py-3.5 font-semibold">Reference</th>
                <th className="py-3.5 font-semibold">Cycle</th>
                <th className="py-3.5 font-semibold">Status</th>
                <th className="py-3.5 font-semibold">Tenant name</th>
                <th className="py-3.5 font-semibold">Rent</th>
                <th className="py-3.5 pr-6 font-semibold">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-10 text-center text-onyx/45 dark:text-white/45">
                    No leases match these filters.
                  </td>
                </tr>
              )}
              {rows.map((a) => {
                const key = `${building.id}-${a.id}`;
                const wasReminded = reminded.includes(key);
                return (
                  <tr
                    key={key}
                    className="border-b border-azure-900/5 last:border-0 dark:border-white/5"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3.5">
                        <Image
                          src={building.interior}
                          alt={a.label}
                          width={96}
                          height={96}
                          className="h-12 w-12 shrink-0 rounded-xl object-cover"
                        />
                        <div className="min-w-0">
                          <p className="whitespace-nowrap font-bold text-azure-950 dark:text-white">
                            {a.label}
                          </p>
                          <p className="whitespace-nowrap text-xs text-onyx/45 dark:text-white/45">
                            {a.rooms} {a.rooms === 1 ? "room" : "rooms"} · {a.sqm} m²
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 pr-4 font-semibold text-azure-950 dark:text-white">{a.id.toUpperCase()}</td>
                    <td className="py-4 pr-4 capitalize text-onyx/60 dark:text-white/60">{a.cycle}</td>
                    <td className="py-4 pr-4">
                      <RentChip status={a.rentStatus} />
                    </td>
                    <td className="py-4 pr-4">
                      <div className="flex items-center gap-2.5">
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-azure-800 text-[11px] font-bold text-soft-500">
                          {a.tenant!.name.split(" ").map((w) => w[0]).join("")}
                        </span>
                        <span className="whitespace-nowrap text-onyx/75 dark:text-white/75">
                          {a.tenant!.name}
                        </span>
                      </div>
                    </td>
                    <td className="py-4 pr-4 font-bold text-azure-950 dark:text-white">{fmt(a.rent)}</td>
                    <td className="py-4 pr-6">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/dashboard/apartments/${a.id}`}
                          className="rounded-xl bg-onyx px-5 py-2 text-sm font-semibold text-white transition hover:bg-azure-900 dark:bg-white dark:text-onyx dark:hover:bg-soft-400"
                        >
                          View
                        </Link>
                        {a.rentStatus === "paid" ? (
                          <button
                            onClick={() =>
                              setReceipt({
                                tenant: a.tenant!.name,
                                apartment: a.label,
                                building: building.name,
                                address: `${building.address}, ${building.city}`,
                                amount: a.rent,
                                period: "August 2026",
                                paidOn: "2 August 2026",
                                reference: `RCP-2026-08-${building.id.slice(0, 3).toUpperCase()}-${a.id.toUpperCase()}`,
                              })
                            }
                            className="rounded-xl border border-azure-900/15 px-4 py-2 text-sm font-semibold text-azure-950 transition hover:bg-azure-900/5 dark:border-white/15 dark:text-white dark:hover:bg-white/10"
                          >
                            Receipt
                          </button>
                        ) : (
                          <button
                            onClick={() => setReminded((r) => [...r, key])}
                            disabled={wasReminded}
                            className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                              wasReminded
                                ? "bg-soft-500/60 text-azure-950/70"
                                : "border border-azure-900/15 text-azure-950 hover:bg-azure-900/5 dark:border-white/15 dark:text-white dark:hover:bg-white/10"
                            }`}
                          >
                            {wasReminded ? "Reminder sent" : "Remind"}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {receipt && <ReceiptModal receipt={receipt} onClose={() => setReceipt(null)} />}
    </>
  );
}
