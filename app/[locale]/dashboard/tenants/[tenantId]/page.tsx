"use client";

import Link from "next/link";
import { notFound, useParams } from "next/navigation";
import { useMemo, useState } from "react";
import {
  byOpenedDesc,
  byPeriodDesc,
  fmt,
  isoPaidOn,
  type RentStatus,
  type TicketStatus,
} from "@/lib/data";
import { useBuilding } from "@/lib/building-context";
import { useStore } from "@/lib/store";
import { useI18n } from "@/lib/i18n/context";
import { Card, CardTitle, RentChip, StatCard, TicketChip, ViaBadge } from "@/components/dashboard/ui";
import { ReceiptModal, type ReceiptData } from "@/components/dashboard/ReceiptModal";

const selectCls =
  "rounded-2xl border border-white/70 bg-white/60 px-4 py-2.5 text-sm font-semibold text-azure-950 backdrop-blur-xl outline-none transition hover:bg-azure-900/5 dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:bg-white/10 dark:[&>option]:bg-onyx";

/**
 * One tenant, everything about them: the money they have paid since day one,
 * every rent period, and every maintenance ticket they have raised.
 */
export default function TenantPage() {
  const { building } = useBuilding();
  const { tickets, markReminded, remindedKeys, notify } = useStore();
  const { t, f, s: ts, path } = useI18n();
  const params = useParams<{ tenantId: string }>();
  const tn = t.dash.tenants;

  const [month, setMonth] = useState("all");
  const [year, setYear] = useState("all");
  const [status, setStatus] = useState("all");
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);

  const apartment = building.apartments.find((a) => a.id === params.tenantId);
  if (!apartment?.tenant) notFound();

  const tenant = apartment.tenant;
  const label = ts("apartments", apartment.label);
  const remindKey = `${building.id}-${apartment.id}`;
  const wasReminded = remindedKeys.includes(remindKey);

  const months = [...new Set(apartment.payments.map((p) => p.month.split(" ")[0]))];
  const years = [...new Set(apartment.payments.map((p) => p.month.split(" ")[1]))].sort(
    (a, b) => Number(b) - Number(a)
  );

  const payments = useMemo(
    () =>
      apartment.payments
        .filter((p) => {
          const [pm, py] = p.month.split(" ");
          return (
            (month === "all" || pm === month) &&
            (year === "all" || py === year) &&
            (status === "all" || p.status === status)
          );
        })
        // Newest period first: the current month is what an agent looks for.
        .sort(byPeriodDesc),
    [apartment.payments, month, year, status]
  );

  const myTickets = useMemo(
    () =>
      tickets
        .filter(
          (x) =>
            x.buildingId === building.id &&
            x.tenant === tenant.name &&
            (month === "all" || x.month === month) &&
            (year === "all" || String(x.year) === year)
        )
        .sort(byOpenedDesc),
    [tickets, building.id, tenant.name, month, year]
  );

  // Lifetime value stays whole, whatever the filters above are set to.
  const lifetime = apartment.payments
    .filter((p) => p.status === "paid")
    .reduce((sum, p) => sum + p.amount, 0);
  const collected = payments
    .filter((p) => p.status === "paid")
    .reduce((sum, p) => sum + p.amount, 0);
  const outstanding = payments.reduce((sum, p) => sum + p.amount, 0) - collected;
  const repairs = myTickets.reduce((sum, x) => sum + (x.cost ?? 0), 0);

  const makeReceipt = (
    period: string,
    amount: number,
    paidOn: string | null,
    /** Untranslated period, so the reference stays stable across languages. */
    key: string
  ): ReceiptData => ({
    tenant: tenant.name,
    tenantPhone: tenant.phone,
    apartment: label,
    building: building.name,
    address: `${building.address}, ${ts("cities", building.city)}`,
    amount,
    period,
    paidOn: isoPaidOn(paidOn, key),
    reference: `RCP-${key.replace(" ", "-").toUpperCase()}-${apartment.id.toUpperCase()}`,
  });

  return (
    <>
      <Link
        href={path("/dashboard/tenants")}
        className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-onyx/50 transition hover:text-azure-950 dark:text-white/50 dark:hover:text-white"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 12H5M12 19l-7-7 7-7" />
        </svg>
        {tn.backToTenants}
      </Link>

      {/* identity */}
      <Card className="mb-6">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="flex items-center gap-4">
            <span className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-azure-800 text-lg font-bold text-soft-500">
              {tenant.name.split(" ").map((w) => w[0]).join("")}
            </span>
            <div className="min-w-0">
              <h1 className="font-serif text-3xl font-medium text-azure-950 dark:text-white">
                {tenant.name}
              </h1>
              <p className="mt-1 text-sm text-onyx/55 dark:text-white/50">
                {f(tn.detailSubtitle, {
                  apartment: label,
                  building: building.name,
                  since: tenant.since,
                })}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <RentChip status={apartment.rentStatus as RentStatus} />
                <span className="rounded-full border border-white/70 bg-white/50 px-3 py-1 text-xs font-semibold text-onyx/60 backdrop-blur-xl dark:border-white/10 dark:bg-white/5 dark:text-white/60">
                  {apartment.cycle === "monthly" ? t.dash.rent.monthly : t.dash.rent.yearly}
                </span>
                <Link
                  href={path(`/dashboard/apartments/${apartment.id}`)}
                  className="rounded-full border border-white/70 bg-white/50 px-3 py-1 text-xs font-semibold text-azure-800 backdrop-blur-xl transition hover:bg-white/80 dark:border-white/10 dark:bg-white/5 dark:text-soft-500 dark:hover:bg-white/10"
                >
                  {tn.viewApartment}
                </Link>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <a
              href={`tel:${tenant.phone.replace(/\s/g, "")}`}
              className="flex items-center gap-2 rounded-full bg-onyx px-5 py-3 text-sm font-semibold text-white transition hover:bg-azure-900 dark:bg-white dark:text-onyx dark:hover:bg-soft-400"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 16.9v3a2 2 0 01-2.2 2 19.8 19.8 0 01-8.6-3.1 19.5 19.5 0 01-6-6A19.8 19.8 0 012.1 4.2 2 2 0 014.1 2h3a2 2 0 012 1.7c.1 1 .3 1.9.6 2.8a2 2 0 01-.4 2.1L8 9.9a16 16 0 006 6l1.3-1.3a2 2 0 012.1-.4c.9.3 1.8.5 2.8.6a2 2 0 011.8 2.1z" />
              </svg>
              {tenant.phone}
            </a>
            <button
              onClick={() => {
                markReminded(building.id, apartment.id);
                notify(f(t.dash.apartment.reminderModal.sent, { name: tenant.name }));
              }}
              disabled={wasReminded}
              className={`rounded-full px-5 py-3 text-sm font-semibold transition ${
                wasReminded
                  ? "bg-soft-500/60 text-azure-950/70"
                  : "border border-azure-900/15 text-azure-950 hover:bg-azure-900/5 dark:border-white/15 dark:text-white dark:hover:bg-white/10"
              }`}
            >
              {wasReminded ? t.dash.rent.reminded : t.dash.rent.remind}
            </button>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard emphasis label={tn.lifetime} value={fmt(lifetime)} hint={tn.sinceStart} />
        <StatCard label={tn.collected} value={fmt(collected)} hint={tn.inPeriod} />
        <StatCard label={tn.outstanding} value={fmt(outstanding)} hint={tn.inPeriod} />
        <StatCard label={tn.repairsSpent} value={fmt(repairs)} hint={tn.ticketsRaised} />
      </div>

      {/* filters shared by both tables below */}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
        <p className="text-sm font-semibold text-onyx/50 dark:text-white/50">{tn.filterHint}</p>
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
            <option value="paid">{t.dash.status.paid}</option>
            <option value="pending">{t.dash.status.pending}</option>
            <option value="overdue">{t.dash.status.overdue}</option>
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

      {/* payment history */}
      <Card className="mt-5 overflow-hidden p-0">
        <div className="p-6">
          <CardTitle>
            {tn.paymentHistory}{" "}
            <span className="ml-1 text-sm font-medium text-onyx/40 dark:text-white/40">
              {t.dash.common.total} {payments.length}
            </span>
          </CardTitle>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-y border-white/60 bg-white/40 text-xs text-onyx/45 dark:border-white/8 dark:bg-white/[0.03] dark:text-white/40">
                <th className="px-6 py-3.5 pr-4 font-semibold">{tn.period}</th>
                <th className="py-3.5 pr-4 font-semibold">{tn.amount}</th>
                <th className="py-3.5 pr-4 font-semibold">{tn.paidOn}</th>
                <th className="py-3.5 pr-4 font-semibold">{t.dash.rent.status}</th>
                <th className="py-3.5 pr-6 font-semibold">{t.dash.rent.action}</th>
              </tr>
            </thead>
            <tbody>
              {payments.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-onyx/45 dark:text-white/45">
                    {tn.noPayments}
                  </td>
                </tr>
              )}
              {payments.map((p) => {
                const [pm, py] = p.month.split(" ");
                return (
                  <tr key={p.month} className="border-b border-azure-900/5 last:border-0 dark:border-white/5">
                    <td className="whitespace-nowrap px-6 py-4 pr-4 font-bold text-azure-950 dark:text-white">
                      {ts("months", pm)} {py}
                    </td>
                    <td className="whitespace-nowrap py-4 pr-4 font-bold text-azure-950 dark:text-white">
                      {fmt(p.amount)}
                    </td>
                    <td className="whitespace-nowrap py-4 pr-4 text-onyx/60 dark:text-white/60">
                      {p.paidOn ?? t.dash.common.none}
                    </td>
                    <td className="py-4 pr-4">
                      <RentChip status={p.status} />
                    </td>
                    <td className="py-4 pr-6">
                      {p.status === "paid" ? (
                        <button
                          onClick={() =>
                            setReceipt(
                              makeReceipt(`${ts("months", pm)} ${py}`, p.amount, p.paidOn, p.month)
                            )
                          }
                          className="rounded-xl border border-azure-900/15 px-4 py-2 text-sm font-semibold text-azure-950 transition hover:bg-azure-900/5 dark:border-white/15 dark:text-white dark:hover:bg-white/10"
                        >
                          {t.dash.rent.receipt}
                        </button>
                      ) : (
                        <span className="text-onyx/35 dark:text-white/35">{t.dash.common.none}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* tickets raised by this tenant */}
      <Card className="mt-6 overflow-hidden p-0">
        <div className="p-6">
          <CardTitle>
            {tn.ticketsTitle}{" "}
            <span className="ml-1 text-sm font-medium text-onyx/40 dark:text-white/40">
              {t.dash.common.total} {myTickets.length}
            </span>
          </CardTitle>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead>
              <tr className="border-y border-white/60 bg-white/40 text-xs text-onyx/45 dark:border-white/8 dark:bg-white/[0.03] dark:text-white/40">
                <th className="px-6 py-3.5 pr-4 font-semibold">{t.dash.maintenance.ticket}</th>
                <th className="py-3.5 pr-4 font-semibold">{t.dash.maintenance.technician}</th>
                <th className="py-3.5 pr-4 font-semibold">{t.dash.maintenance.status}</th>
                <th className="py-3.5 pr-4 font-semibold">{t.dash.maintenance.cost}</th>
                <th className="py-3.5 pr-6 font-semibold">{t.dash.maintenance.delay}</th>
              </tr>
            </thead>
            <tbody>
              {myTickets.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-onyx/45 dark:text-white/45">
                    {tn.noTickets}
                  </td>
                </tr>
              )}
              {myTickets.map((x) => (
                <tr key={x.id} className="border-b border-azure-900/5 last:border-0 dark:border-white/5">
                  <td className="px-6 py-4 pr-4">
                    <p className="font-bold text-azure-950 dark:text-white">{ts("tickets", x.title)}</p>
                    <div className="mt-1 flex items-center gap-2">
                      <span className="text-xs text-onyx/40 dark:text-white/40">{x.id}</span>
                      <ViaBadge via={x.reportedVia} />
                    </div>
                  </td>
                  <td className="whitespace-nowrap py-4 pr-4 text-onyx/70 dark:text-white/70">
                    {x.assignee ?? (
                      <span className="text-onyx/35 dark:text-white/35">
                        {t.dash.maintenance.unassigned}
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

      {receipt && <ReceiptModal receipt={receipt} onClose={() => setReceipt(null)} />}
    </>
  );
}
