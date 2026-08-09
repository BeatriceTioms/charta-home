"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { fmt, getBuilding, tickets, type TicketStatus } from "@/lib/data";
import {
  PageTitle,
  StatCard,
  TicketChip,
  ViaBadge,
} from "@/components/dashboard/ui";

const selectCls =
  "rounded-2xl border border-azure-900/10 bg-white px-4 py-2.5 text-sm font-semibold text-azure-950 outline-none transition hover:bg-azure-900/5 dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:bg-white/10 dark:[&>option]:bg-onyx";

export default function MaintenancePage() {
  const [month, setMonth] = useState("all");
  const [year, setYear] = useState("all");
  const [status, setStatus] = useState("all");

  const months = [...new Set(tickets.map((t) => t.month))];
  const years = [...new Set(tickets.map((t) => t.year))].sort((a, b) => b - a);

  const filtered = useMemo(
    () =>
      tickets.filter(
        (t) =>
          (month === "all" || t.month === month) &&
          (year === "all" || t.year === Number(year)) &&
          (status === "all" || t.status === status)
      ),
    [month, year, status]
  );

  const open = filtered.filter((t) => t.status !== "resolved");
  const resolved = filtered.filter((t) => t.status === "resolved");
  const spent = filtered.reduce((s, t) => s + (t.cost ?? 0), 0);
  const avgDelay = resolved.length
    ? (resolved.reduce((s, t) => s + t.daysOpen, 0) / resolved.length).toFixed(1)
    : "0";

  return (
    <>
      <PageTitle
        title="Maintenance"
        subtitle="Every request your tenants report, tracked from first message to confirmed fix."
        action={
          <button className="rounded-full bg-soft-500 px-6 py-3 text-sm font-semibold text-azure-950 transition hover:bg-soft-400">
            New ticket
          </button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard emphasis label="Open tickets" value={String(open.length)} hint="in the selected period" />
        <StatCard label="Resolved" value={String(resolved.length)} hint="in the selected period" />
        <StatCard label="Money spent" value={fmt(spent)} hint="repairs and services" />
        <StatCard label="Average delay" value={`${avgDelay} days`} hint="from report to fix" />
      </div>

      {/* table card */}
      <div className="mt-6 rounded-3xl border border-azure-900/8 bg-white shadow-sm shadow-azure-900/5 dark:border-white/8 dark:bg-white/[0.04] dark:shadow-none">
        <div className="flex flex-wrap items-center justify-between gap-4 p-6">
          <p className="text-lg font-bold text-azure-950 dark:text-white">
            Tickets{" "}
            <span className="ml-1 text-sm font-medium text-onyx/40 dark:text-white/40">
              Total {filtered.length}
            </span>
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <select value={month} onChange={(e) => setMonth(e.target.value)} className={selectCls} aria-label="Filter by month">
              <option value="all">All months</option>
              {months.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
            <select value={year} onChange={(e) => setYear(e.target.value)} className={selectCls} aria-label="Filter by year">
              <option value="all">All years</option>
              {years.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
            <select value={status} onChange={(e) => setStatus(e.target.value)} className={selectCls} aria-label="Filter by status">
              <option value="all">All statuses</option>
              <option value="new">New</option>
              <option value="assigned">Assigned</option>
              <option value="in-progress">In progress</option>
              <option value="resolved">Resolved</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] text-left text-sm">
            <thead>
              <tr className="border-y border-azure-900/8 bg-soft-50 text-xs text-onyx/45 dark:border-white/8 dark:bg-white/[0.03] dark:text-white/40">
                <th className="px-6 py-3.5 font-semibold">Ticket</th>
                <th className="py-3.5 font-semibold">Tenant</th>
                <th className="py-3.5 font-semibold">Location</th>
                <th className="py-3.5 font-semibold">Technician</th>
                <th className="py-3.5 font-semibold">Status</th>
                <th className="py-3.5 font-semibold">Cost</th>
                <th className="py-3.5 font-semibold">Delay</th>
                <th className="py-3.5 pr-6 font-semibold">Period</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-6 py-10 text-center text-onyx/45 dark:text-white/45">
                    No tickets match these filters.
                  </td>
                </tr>
              )}
              {filtered.map((t) => {
                const b = getBuilding(t.buildingId)!;
                return (
                  <tr
                    key={t.id}
                    className="border-b border-azure-900/5 last:border-0 dark:border-white/5"
                  >
                    <td className="px-6 py-4">
                      <p className="font-bold text-azure-950 dark:text-white">{t.title}</p>
                      <div className="mt-1 flex items-center gap-2">
                        <span className="text-xs text-onyx/40 dark:text-white/40">{t.id}</span>
                        <ViaBadge via={t.reportedVia} />
                      </div>
                    </td>
                    <td className="py-4 pr-4">
                      {t.tenant ? (
                        <div className="flex items-center gap-2.5">
                          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-azure-800 text-[10px] font-bold text-soft-500">
                            {t.tenant.split(" ").map((w) => w[0]).join("")}
                          </span>
                          <span className="whitespace-nowrap text-onyx/75 dark:text-white/75">{t.tenant}</span>
                        </div>
                      ) : (
                        <span className="text-onyx/40 dark:text-white/40">Building</span>
                      )}
                    </td>
                    <td className="py-4 pr-4">
                      <Link
                        href={`/dashboard/buildings/${b.id}`}
                        className="whitespace-nowrap font-semibold text-azure-950 transition hover:text-azure-600 dark:text-white dark:hover:text-soft-500"
                      >
                        {b.name}
                      </Link>
                      <p className="text-xs text-onyx/45 dark:text-white/45">{t.apartment}</p>
                    </td>
                    <td className="whitespace-nowrap py-4 pr-4 text-onyx/70 dark:text-white/70">
                      {t.assignee ?? (
                        <button className="rounded-full border border-azure-900/15 px-3.5 py-1.5 text-xs font-semibold text-azure-600 transition hover:bg-azure-900/5 dark:border-white/15 dark:text-soft-500 dark:hover:bg-white/10">
                          Assign
                        </button>
                      )}
                    </td>
                    <td className="py-4 pr-4">
                      <TicketChip status={t.status as TicketStatus} />
                    </td>
                    <td className="whitespace-nowrap py-4 pr-4 font-bold text-azure-950 dark:text-white">
                      {t.cost !== undefined ? fmt(t.cost) : (
                        <span className="font-medium text-onyx/40 dark:text-white/40">Pending</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap py-4 pr-4 text-onyx/60 dark:text-white/60">
                      {t.daysOpen} {t.daysOpen === 1 ? "day" : "days"}
                    </td>
                    <td className="whitespace-nowrap py-4 pr-6 text-onyx/60 dark:text-white/60">
                      {t.month} {t.year}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
