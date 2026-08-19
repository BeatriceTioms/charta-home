"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { type RentStatus } from "@/lib/data";
import { useBuilding } from "@/lib/building-context";
import { useStore } from "@/lib/store";
import { useMoney } from "@/lib/money";
import { useI18n } from "@/lib/i18n/context";
import { RentChip, StatCard } from "@/components/dashboard/ui";

const selectCls =
  "rounded-2xl border border-white/70 bg-white/60 px-4 py-2.5 text-sm font-semibold text-azure-950 backdrop-blur-xl outline-none transition hover:bg-azure-900/5 dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:bg-white/10 dark:[&>option]:bg-onyx";

/**
 * Tenant directory for the building, narrowed by period, apartment and status.
 * The chosen period drives the figures: what each tenant was charged over it
 * and what they actually settled. Lives as a tab on the rent collection page.
 */
export function TenantsPanel() {
  const { building } = useBuilding();
  const { tickets } = useStore();
  const { t, f, s: ts, path } = useI18n();
  const { fmt } = useMoney();
  const tn = t.dash.tenants;

  const [month, setMonth] = useState("all");
  const [year, setYear] = useState("all");
  const [apartment, setApartment] = useState("all");
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");

  const leased = building.apartments.filter((a) => a.tenant);

  // Payment periods are stored as "Aug 2026", so both filters read off one field.
  const periods = leased.flatMap((a) => a.payments.map((p) => p.month.split(" ")));
  const months = [...new Set(periods.map(([m]) => m))];
  const years = [...new Set(periods.map(([, y]) => y))].sort((a, b) => Number(b) - Number(a));

  const rows = useMemo(
    () =>
      leased
        .filter((a) => apartment === "all" || a.id === apartment)
        .filter((a) => a.tenant!.name.toLowerCase().includes(search.trim().toLowerCase()))
        .map((a) => {
          const inPeriod = a.payments.filter((p) => {
            const [pm, py] = p.month.split(" ");
            return (month === "all" || pm === month) && (year === "all" || py === year);
          });
          const collected = inPeriod
            .filter((p) => p.status === "paid")
            .reduce((sum, p) => sum + p.amount, 0);
          const charged = inPeriod.reduce((sum, p) => sum + p.amount, 0);
          const periodStatus: RentStatus = inPeriod.some((p) => p.status === "overdue")
            ? "overdue"
            : inPeriod.some((p) => p.status === "pending")
              ? "pending"
              : inPeriod.length > 0
                ? "paid"
                : a.rentStatus;
          // Lifetime value, independent of the period filter.
          const lifetime = a.payments
            .filter((p) => p.status === "paid")
            .reduce((sum, p) => sum + p.amount, 0);
          const openTickets = tickets.filter(
            (x) =>
              x.buildingId === building.id &&
              x.tenant === a.tenant!.name &&
              x.status !== "resolved"
          ).length;
          return {
            apt: a,
            inPeriod,
            collected,
            outstanding: charged - collected,
            periodStatus,
            lifetime,
            openTickets,
          };
        })
        // A tenant with nothing in the chosen period is not part of that period.
        .filter((r) => (month === "all" && year === "all") || r.inPeriod.length > 0)
        .filter((r) => status === "all" || r.periodStatus === status),
    [leased, tickets, building.id, month, year, apartment, status, search]
  );

  const collected = rows.reduce((sum, r) => sum + r.collected, 0);
  const outstanding = rows.reduce((sum, r) => sum + r.outstanding, 0);
  const lifetime = rows.reduce((sum, r) => sum + r.lifetime, 0);

  const reset = () => {
    setMonth("all");
    setYear("all");
    setApartment("all");
    setStatus("all");
    setSearch("");
  };

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard emphasis label={tn.count} value={String(rows.length)} hint={tn.inPeriod} />
        <StatCard label={tn.collected} value={fmt(collected)} hint={tn.inPeriod} />
        <StatCard label={tn.outstanding} value={fmt(outstanding)} hint={tn.inPeriod} />
        <StatCard label={tn.lifetime} value={fmt(lifetime)} hint={tn.sinceStart} />
      </div>

      <div className="mt-6 rounded-3xl border border-white/70 bg-white/55 shadow-lg shadow-azure-900/5 backdrop-blur-2xl dark:border-white/10 dark:bg-white/[0.05] dark:shadow-none">
        <div className="flex flex-wrap items-center justify-between gap-4 p-6">
          <p className="text-lg font-bold text-azure-950 dark:text-white">
            {tn.title}{" "}
            <span className="ml-1 text-sm font-medium text-onyx/40 dark:text-white/40">
              {t.dash.common.total} {rows.length}
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
                placeholder={t.dash.rent.searchTenants}
                className="w-36 bg-transparent text-sm text-azure-950 outline-none placeholder:text-onyx/35 dark:text-white dark:placeholder:text-white/35"
              />
            </div>
            <select
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className={selectCls}
              aria-label={t.dash.common.allMonths}
            >
              <option value="all">{t.dash.common.allMonths}</option>
              {months.map((mm) => (
                <option key={mm} value={mm}>{ts("months", mm)}</option>
              ))}
            </select>
            <select
              value={year}
              onChange={(e) => setYear(e.target.value)}
              className={selectCls}
              aria-label={t.dash.common.allYears}
            >
              <option value="all">{t.dash.common.allYears}</option>
              {years.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
            <select
              value={apartment}
              onChange={(e) => setApartment(e.target.value)}
              className={selectCls}
              aria-label={tn.allApartments}
            >
              <option value="all">{tn.allApartments}</option>
              {leased.map((a) => (
                <option key={a.id} value={a.id}>{a.label}</option>
              ))}
            </select>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className={selectCls}
              aria-label={t.dash.common.allStatuses}
            >
              <option value="all">{t.dash.common.allStatuses}</option>
              <option value="paid">{t.dash.status.paid}</option>
              <option value="pending">{t.dash.status.pending}</option>
              <option value="overdue">{t.dash.status.overdue}</option>
            </select>
            <button
              onClick={reset}
              className="flex items-center gap-2 rounded-2xl border border-white/70 bg-white/60 px-4 py-2.5 text-sm font-semibold text-azure-950 backdrop-blur-xl transition hover:bg-azure-900/5 dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:bg-white/10"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 12a9 9 0 109-9 9.75 9.75 0 00-6.74 2.74L3 8" />
                <path d="M3 3v5h5" />
              </svg>
              {t.dash.common.reset}
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1040px] text-left text-sm">
            <thead>
              <tr className="border-y border-white/60 bg-white/40 text-xs text-onyx/45 dark:border-white/8 dark:bg-white/[0.03] dark:text-white/40">
                <th className="px-6 py-3.5 pr-4 font-semibold">{t.dash.rent.tenantName}</th>
                <th className="py-3.5 pr-4 font-semibold">{tn.phone}</th>
                <th className="py-3.5 pr-4 font-semibold">{t.dash.rent.apartment}</th>
                <th className="py-3.5 pr-4 font-semibold">{tn.since}</th>
                <th className="py-3.5 pr-4 font-semibold">{t.dash.rent.rent}</th>
                <th className="py-3.5 pr-4 font-semibold">{tn.collected}</th>
                <th className="py-3.5 pr-4 font-semibold">{tn.lifetime}</th>
                <th className="py-3.5 pr-4 font-semibold">{tn.periodStatus}</th>
                <th className="py-3.5 pr-6 font-semibold">{t.dash.rent.action}</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-6 py-10 text-center text-onyx/45 dark:text-white/45">
                    {tn.empty}
                  </td>
                </tr>
              )}
              {rows.map(({ apt, inPeriod, collected: paid, lifetime: value, periodStatus, openTickets }) => (
                <tr key={apt.id} className="border-b border-azure-900/5 last:border-0 dark:border-white/5">
                  <td className="px-6 py-4 pr-4">
                    <div className="flex items-center gap-3">
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-azure-800 text-[11px] font-bold text-soft-500">
                        {apt.tenant!.name.split(" ").map((w) => w[0]).join("")}
                      </span>
                      <div className="min-w-0">
                        <p className="whitespace-nowrap font-bold text-azure-950 dark:text-white">
                          {apt.tenant!.name}
                        </p>
                        <p className="whitespace-nowrap text-xs text-onyx/45 dark:text-white/45">
                          {apt.cycle === "monthly" ? t.dash.rent.monthly : t.dash.rent.yearly} ·{" "}
                          {f(
                            inPeriod.length === 1 ? tn.paymentsCountOne : tn.paymentsCount,
                            { count: inPeriod.length }
                          )}
                          {openTickets > 0 ? ` · ${f(tn.openTickets, { count: openTickets })}` : ""}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="whitespace-nowrap py-4 pr-4 text-onyx/70 dark:text-white/70">
                    {apt.tenant!.phone}
                  </td>
                  <td className="whitespace-nowrap py-4 pr-4 font-semibold text-azure-950 dark:text-white">
                    {apt.label}
                  </td>
                  <td className="whitespace-nowrap py-4 pr-4 text-onyx/60 dark:text-white/60">
                    {apt.tenant!.since}
                  </td>
                  <td className="whitespace-nowrap py-4 pr-4 font-bold text-azure-950 dark:text-white">
                    {fmt(apt.rent)}
                  </td>
                  <td className="whitespace-nowrap py-4 pr-4 font-bold text-azure-950 dark:text-white">
                    {fmt(paid)}
                  </td>
                  <td className="whitespace-nowrap py-4 pr-4 font-bold text-azure-800 dark:text-soft-500">
                    {fmt(value)}
                  </td>
                  <td className="py-4 pr-4">
                    <RentChip status={periodStatus} />
                  </td>
                  <td className="py-4 pr-6">
                    <Link
                      href={path(`/dashboard/tenants/${apt.id}`)}
                      className="whitespace-nowrap rounded-xl bg-onyx px-5 py-2 text-sm font-semibold text-white transition hover:bg-azure-900 dark:bg-white dark:text-onyx dark:hover:bg-soft-400"
                    >
                      {tn.openFile}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
