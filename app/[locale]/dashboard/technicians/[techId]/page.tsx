"use client";

import Link from "next/link";
import { notFound, useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { byOpenedDesc, fmt, type TicketStatus } from "@/lib/data";
import { useBuilding } from "@/lib/building-context";
import { useStore } from "@/lib/store";
import { useI18n } from "@/lib/i18n/context";
import { Card, CardTitle, StatCard, TicketChip, ViaBadge } from "@/components/dashboard/ui";
import { TechnicianForm } from "@/components/dashboard/TechniciansPanel";
import { Modal } from "@/components/dashboard/Modal";

const selectCls =
  "rounded-2xl border border-white/70 bg-white/60 px-4 py-2.5 text-sm font-semibold text-azure-950 backdrop-blur-xl outline-none transition hover:bg-azure-900/5 dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:bg-white/10 dark:[&>option]:bg-onyx";

/**
 * One technician, and everything they have touched: what they have been paid
 * since they started, how fast they close, and every job with its cost.
 */
export default function TechnicianPage() {
  const { building } = useBuilding();
  const { technicians, tickets, deleteTechnician, notify } = useStore();
  const { t, f, s: ts, path } = useI18n();
  const params = useParams<{ techId: string }>();
  const tr = t.dash.technicians;

  const [month, setMonth] = useState("all");
  const [year, setYear] = useState("all");
  const [status, setStatus] = useState("all");
  const [editing, setEditing] = useState(false);
  const [removing, setRemoving] = useState(false);

  const tech = technicians.find((x) => x.id === params.techId);
  if (!tech) notFound();

  // Match on id, and fall back to the seeded assignee text for demo data.
  const mine = useMemo(
    () =>
      tickets.filter((x) => x.technicianId === tech.id || x.assignee?.startsWith(tech.name)),
    [tickets, tech.id, tech.name]
  );

  const months = [...new Set(mine.map((x) => x.month))];
  const years = [...new Set(mine.map((x) => x.year))].sort((a, b) => b - a);

  const jobs = useMemo(
    () =>
      mine
        .filter(
          (x) =>
            (month === "all" || x.month === month) &&
            (year === "all" || String(x.year) === year) &&
            (status === "all" || x.status === status)
        )
        .sort(byOpenedDesc),
    [mine, month, year, status]
  );

  // Paid to date stays whole, whatever the filters above are set to.
  const allResolved = mine.filter((x) => x.status === "resolved");
  const lifetimePaid = allResolved.reduce((sum, x) => sum + (x.cost ?? 0), 0);

  const resolved = jobs.filter((x) => x.status === "resolved");
  const paid = resolved.reduce((sum, x) => sum + (x.cost ?? 0), 0);
  const avgDays = resolved.length
    ? Number((resolved.reduce((sum, x) => sum + x.daysOpen, 0) / resolved.length).toFixed(1))
    : null;

  return (
    <>
      <Link
        href={path("/dashboard/maintenance")}
        className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-onyx/50 transition hover:text-azure-950 dark:text-white/50 dark:hover:text-white"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 12H5M12 19l-7-7 7-7" />
        </svg>
        {tr.backToTechnicians}
      </Link>

      {/* identity */}
      <Card className="mb-6">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="flex items-center gap-4">
            <span className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-azure-800 text-lg font-bold text-soft-500">
              {tech.name.split(" ").map((w) => w[0]).join("").slice(0, 2)}
            </span>
            <div className="min-w-0">
              <h1 className="font-serif text-3xl font-medium text-azure-950 dark:text-white">
                {tech.name}
              </h1>
              <p className="mt-1 text-sm text-onyx/55 dark:text-white/50">
                {f(tr.detailSubtitle, {
                  trade: tech.trade,
                  building: building.name,
                  since: tech.since,
                })}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-onyx px-3 py-1 text-xs font-bold text-white dark:bg-white dark:text-onyx">
                  {tech.isExternal ? tr.external : tr.internal}
                </span>
                <span className="rounded-full border border-white/70 bg-white/50 px-3 py-1 text-xs font-semibold text-onyx/60 backdrop-blur-xl dark:border-white/10 dark:bg-white/5 dark:text-white/60">
                  {tech.trade}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {tech.phone && (
              <a
                href={`tel:${tech.phone.replace(/\s/g, "")}`}
                className="flex items-center gap-2 rounded-full bg-onyx px-5 py-3 text-sm font-semibold text-white transition hover:bg-azure-900 dark:bg-white dark:text-onyx dark:hover:bg-soft-400"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 16.9v3a2 2 0 01-2.2 2 19.8 19.8 0 01-8.6-3.1 19.5 19.5 0 01-6-6A19.8 19.8 0 012.1 4.2 2 2 0 014.1 2h3a2 2 0 012 1.7c.1 1 .3 1.9.6 2.8a2 2 0 01-.4 2.1L8 9.9a16 16 0 006 6l1.3-1.3a2 2 0 012.1-.4c.9.3 1.8.5 2.8.6a2 2 0 011.8 2.1z" />
                </svg>
                {tech.phone}
              </a>
            )}
            <button
              onClick={() => setEditing(true)}
              className="rounded-full border border-azure-900/15 px-5 py-3 text-sm font-semibold text-azure-950 transition hover:bg-azure-900/5 dark:border-white/15 dark:text-white dark:hover:bg-white/10"
            >
              {t.dash.maintenance.edit}
            </button>
            <button
              onClick={() => setRemoving(true)}
              className="rounded-full border border-azure-900/15 px-5 py-3 text-sm font-semibold text-red-600 transition hover:bg-red-50 dark:border-white/15 dark:hover:bg-red-500/10"
            >
              {t.dash.maintenance.delete}
            </button>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard emphasis label={tr.totalPaid} value={fmt(lifetimePaid)} hint={tr.sinceStart} />
        <StatCard label={tr.jobsTotal} value={String(jobs.length)} hint={t.dash.maintenance.inPeriod} />
        <StatCard label={tr.paidInPeriod} value={fmt(paid)} hint={t.dash.maintenance.inPeriod} />
        <StatCard
          label={tr.avgDelay}
          value={avgDays === null ? tr.never : `${avgDays} ${t.dash.common.days}`}
          hint={t.dash.maintenance.reportToFix}
        />
      </div>

      {/* filters */}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
        <p className="text-sm font-semibold text-onyx/50 dark:text-white/50">{tr.filterHint}</p>
        <div className="flex flex-wrap items-center gap-3">
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
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className={selectCls}
            aria-label={t.dash.common.allStatuses}
          >
            <option value="all">{t.dash.common.allStatuses}</option>
            <option value="new">{t.dash.status.new}</option>
            <option value="assigned">{t.dash.status.assigned}</option>
            <option value="in-progress">{t.dash.status.inProgress}</option>
            <option value="resolved">{t.dash.status.resolved}</option>
          </select>
          <button
            onClick={() => {
              setMonth("all");
              setYear("all");
              setStatus("all");
            }}
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

      {/* every job they have been given */}
      <Card className="mt-5 overflow-hidden p-0">
        <div className="p-6">
          <CardTitle>
            {tr.jobsTitle}{" "}
            <span className="ml-1 text-sm font-medium text-onyx/40 dark:text-white/40">
              {t.dash.common.total} {jobs.length}
            </span>
          </CardTitle>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[880px] text-left text-sm">
            <thead>
              <tr className="border-y border-white/60 bg-white/40 text-xs text-onyx/45 dark:border-white/8 dark:bg-white/[0.03] dark:text-white/40">
                <th className="px-6 py-3.5 pr-4 font-semibold">{t.dash.maintenance.ticket}</th>
                <th className="py-3.5 pr-4 font-semibold">{t.dash.maintenance.apartment}</th>
                <th className="py-3.5 pr-4 font-semibold">{t.dash.maintenance.tenant}</th>
                <th className="py-3.5 pr-4 font-semibold">{t.dash.maintenance.status}</th>
                <th className="py-3.5 pr-4 font-semibold">{t.dash.maintenance.cost}</th>
                <th className="py-3.5 pr-6 font-semibold">{t.dash.maintenance.delay}</th>
              </tr>
            </thead>
            <tbody>
              {jobs.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-onyx/45 dark:text-white/45">
                    {tr.noJobs}
                  </td>
                </tr>
              )}
              {jobs.map((x) => (
                <tr key={x.id} className="border-b border-azure-900/5 last:border-0 dark:border-white/5">
                  <td className="px-6 py-4 pr-4">
                    <p className="font-bold text-azure-950 dark:text-white">{x.title}</p>
                    <div className="mt-1 flex items-center gap-2">
                      <span className="text-xs text-onyx/40 dark:text-white/40">{x.id}</span>
                      <ViaBadge via={x.reportedVia} />
                    </div>
                  </td>
                  <td className="whitespace-nowrap py-4 pr-4 font-semibold text-azure-950 dark:text-white">
                    {x.apartment}
                  </td>
                  <td className="whitespace-nowrap py-4 pr-4 text-onyx/70 dark:text-white/70">
                    {x.tenant ?? (
                      <span className="text-onyx/35 dark:text-white/35">
                        {t.dash.maintenance.building}
                      </span>
                    )}
                  </td>
                  <td className="py-4 pr-4">
                    <TicketChip status={x.status as TicketStatus} />
                  </td>
                  <td className="whitespace-nowrap py-4 pr-4 font-bold text-azure-950 dark:text-white">
                    {x.cost !== undefined ? (
                      fmt(x.cost)
                    ) : (
                      <span className="font-medium text-onyx/40 dark:text-white/40">
                        {t.dash.common.pending}
                      </span>
                    )}
                  </td>
                  <td className="whitespace-nowrap py-4 pr-6 text-onyx/60 dark:text-white/60">
                    {x.daysOpen} {x.daysOpen === 1 ? t.dash.common.day : t.dash.common.days}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {editing && <TechnicianForm technician={tech} onClose={() => setEditing(false)} />}

      {removing && (
        <Modal
          title={f(tr.deleteConfirm.title, { name: tech.name })}
          subtitle={tr.deleteConfirm.subtitle}
          onClose={() => setRemoving(false)}
        >
          <div className="flex gap-3">
            <Link
              href={path("/dashboard/maintenance")}
              onClick={() => {
                deleteTechnician(tech.id);
                notify(f(tr.deleteConfirm.deleted, { name: tech.name }));
              }}
              className="flex-1 rounded-full bg-red-600 py-3 text-center text-sm font-semibold text-white transition hover:bg-red-700"
            >
              {tr.deleteConfirm.submit}
            </Link>
            <button
              onClick={() => setRemoving(false)}
              className="rounded-full border border-azure-900/15 px-6 py-3 text-sm font-semibold text-azure-800 transition hover:bg-azure-900/5 dark:border-white/15 dark:text-white dark:hover:bg-white/10"
            >
              {t.dash.common.cancel}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
