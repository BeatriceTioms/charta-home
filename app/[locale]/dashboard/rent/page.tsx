"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { byPeriodDesc, cycleLabel, shortRef, type RentStatus } from "@/lib/data";
import { useBuilding } from "@/lib/building-context";
import { useStore } from "@/lib/store";
import { useMoney } from "@/lib/money";
import { useI18n } from "@/lib/i18n/context";
import { PageTitle, PhotoPlaceholder, RentChip, StatCard, Tabs } from "@/components/dashboard/ui";
import { TenantsPanel } from "@/components/dashboard/TenantsPanel";
import { ReceiptModal, type ReceiptData } from "@/components/dashboard/ReceiptModal";
import { Field, Modal, ModalActions, fieldCls } from "@/components/dashboard/Modal";
import { ReminderModal } from "@/components/dashboard/ReminderModal";
import { RemindersPanel } from "@/components/dashboard/RemindersPanel";

type Tab = "leases" | "tenants" | "reminders";
type StatusFilter = "all" | RentStatus;

const selectCls =
  "rounded-2xl border border-white/70 bg-white/60 px-4 py-2.5 text-sm font-semibold text-azure-950 backdrop-blur-xl outline-none transition hover:bg-azure-900/5 dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:bg-white/10 dark:[&>option]:bg-onyx";

function RecordPaymentModal({ onClose }: { onClose: () => void }) {
  const { t, f, s: ts } = useI18n();
  const { building } = useBuilding();
  const { recordPayment, notify } = useStore();
  const { fmt } = useMoney();
  const m = t.dash.rent.recordModal;

  // Any leased apartment can take a payment, not only the ones in arrears.
  const leased = building.apartments.filter((a) => a.tenant);
  const [query, setQuery] = useState("");
  const [aptId, setAptId] = useState(
    leased.find((a) => a.rentStatus !== "paid")?.id ?? leased[0]?.id ?? ""
  );

  const [periods, setPeriods] = useState(1);
  const [proof, setProof] = useState<File | undefined>();
  const [amount, setAmount] = useState(0);

  const matches = leased.filter((a) =>
    `${a.tenant!.name} ${a.label}`.toLowerCase().includes(query.trim().toLowerCase())
  );
  const selected = building.apartments.find((a) => a.id === aptId);

  // Each tenant has their own rent, so changing who is paying resets what is
  // suggested, times however many periods are being settled.
  useEffect(() => {
    if (selected) setAmount(selected.rent * periods);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id]);

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selected) return;
    const data = new FormData(e.currentTarget);
    recordPayment(building.id, selected.id, {
      amount,
      method: String(data.get("method") ?? "cash"),
      paidOn: String(data.get("date") ?? ""),
      reference: String(data.get("reference") ?? ""),
      periods,
      proof,
    });
    notify(f(m.recorded, { amount: fmt(amount) }));
    onClose();
  };

  return (
    <Modal title={m.title} subtitle={m.subtitle} onClose={onClose}>
      {leased.length === 0 ? (
        <p className="text-sm text-onyx/55 dark:text-white/55">{m.noLeases}</p>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          {/* One dropdown instead of a search box above a five row listbox.
              The tenant is who this payment is for, so their name is the
              first thing on screen and stays visible while the rest is
              filled in, rather than scrolling away inside a list. */}
          <Field label={m.selectTenant}>
            <select
              name="lease"
              value={aptId}
              onChange={(e) => setAptId(e.target.value)}
              className={fieldCls}
            >
              {leased.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.tenant!.name} · {a.label}
                </option>
              ))}
            </select>
          </Field>

          {selected && (
            <div className="flex items-center gap-3 rounded-2xl bg-soft-200/60 px-4 py-3 dark:bg-white/10">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-azure-800 text-xs font-bold text-soft-500">
                {selected.tenant!.name.split(" ").map((w) => w[0]).join("").slice(0, 2)}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-azure-950 dark:text-white">
                  {selected.tenant!.name}
                </p>
                <p className="truncate text-xs text-onyx/55 dark:text-white/55">
                  {selected.label} · {fmt(selected.rent)} ·{" "}
                  {cycleLabel(selected.cycle, t.dash.rent)}
                  {selected.rentStatus !== "paid" && (
                    <span className="font-semibold text-red-600 dark:text-red-400">
                      {" "}· {t.dash.status[selected.rentStatus]}
                    </span>
                  )}
                </p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Field label={m.amount}>
              <input
                name="amount"
                type="number"
                min={0}
                step={10}
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
                className={fieldCls}
              />
            </Field>
            <Field label={m.date}>
              <input name="date" type="date" defaultValue="2026-08-08" className={fieldCls} />
            </Field>
          </div>

          {/* Periods and method share a row: both are short answers, and the
              form was long enough to scroll, which put the tenant's name out
              of sight exactly when somebody wanted to check it. */}
          <div className="grid grid-cols-2 gap-3">
            <Field label={m.periods}>
              <input
                name="periods"
                type="number"
                min={1}
                max={60}
                value={periods}
                onChange={(e) => {
                  const next = Math.max(1, Number(e.target.value) || 1);
                  setPeriods(next);
                  // The amount follows the count, because someone entering six
                  // months means six months of rent unless they say otherwise.
                  if (selected) setAmount(selected.rent * next);
                }}
                className={fieldCls}
              />
            </Field>
            <Field label={m.method}>
              <select name="method" defaultValue="cash" className={fieldCls}>
                <option value="cash">{m.methods.cash}</option>
                <option value="orange">{m.methods.orange}</option>
                <option value="mtn">{m.methods.mtn}</option>
                <option value="bank">{m.methods.bank}</option>
              </select>
            </Field>
          </div>

          {periods > 1 && selected && (
            <p className="-mt-1 text-xs text-onyx/55 dark:text-white/55">
              {f(m.periodsHint, {
                count: String(periods),
                cycle: cycleLabel(selected.cycle, t.dash.rent).toLowerCase(),
                total: fmt(selected.rent * periods),
              })}
            </p>
          )}

          <Field label={m.reference}>
            <input name="reference" className={fieldCls} />
          </Field>

          {/* No card processing here, so the proof of a payment is a
              photograph of a slip or an Orange Money confirmation. */}
          <Field label={m.proof} hint={m.proofHint} hintAfter>
            <input
              name="proof"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => setProof(e.target.files?.[0])}
              className="block w-full text-sm text-onyx/70 file:mr-3 file:rounded-full file:border-0 file:bg-azure-900/10 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-azure-900 hover:file:bg-azure-900/15 dark:text-white/70 dark:file:bg-white/10 dark:file:text-white"
            />
          </Field>
          <ModalActions onCancel={onClose} submitLabel={m.submit} />
        </form>
      )}
    </Modal>
  );
}


export default function RentPage() {
  const { building } = useBuilding();
  const { markReminded, remindedKeys, notify } = useStore();
  const { t, f, s: ts, path } = useI18n();
  const { fmt } = useMoney();

  const [tab, setTab] = useState<Tab>("leases");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const [recording, setRecording] = useState(false);
  // Chasing rent from the table now opens the same composer as the unit page,
  // rather than only colouring the button in.
  const [reminding, setReminding] = useState<{
    name: string;
    phone: string;
    apartment: string;
    amount: number;
    key: string;
    buildingId: string;
    apartmentId: string;
  } | null>(null);

  const leased = building.apartments.filter((a) => a.tenant);
  const due = leased.reduce((s, a) => s + a.rent, 0);

  // Money actually received this year, and what is still owed across every
  // billed period. Both come from the ledger rather than from the current
  // rent of whoever happens to be marked paid, so a tenant on a half yearly
  // term counts for what they handed over rather than for one month of it.
  const collected = building.incomeYtd;
  const outstanding = leased.reduce(
    (total, a) =>
      total +
      a.payments
        .filter((p) => p.status !== "paid")
        .reduce((sum, p) => sum + p.amount, 0),
    0
  );
  const behind = leased.filter((a) => a.rentStatus !== "paid").length;

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
          (status === "all" || a.rentStatus === status) &&
          a.tenant!.name.toLowerCase().includes(search.toLowerCase())
      ),
    [leased, status, search]
  );

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: "leases", label: t.dash.rent.tabs.leases, count: counts.all },
    { key: "tenants", label: t.dash.rent.tabs.tenants, count: leased.length },
    // No count: a cadence is not a number of things.
    { key: "reminders", label: t.dash.rent.tabs.reminders },
  ];

  const statuses: { key: StatusFilter; label: string; count: number }[] = [
    { key: "all", label: t.dash.common.allStatuses, count: counts.all },
    { key: "paid", label: t.dash.status.paid, count: counts.paid },
    { key: "pending", label: t.dash.status.pending, count: counts.pending },
    { key: "overdue", label: t.dash.status.overdue, count: counts.overdue },
  ];

  /** The most recent settled period for a lease, in the reader's language. */
  const latestPaidPeriod = (a: (typeof leased)[number]) => {
    const last = [...a.payments].filter((p) => p.status === "paid").sort(byPeriodDesc)[0];
    if (!last) return "";
    const [mm, yy] = last.month.split(" ");
    return `${ts("months", mm)} ${yy}`;
  };

  const exportCsv = () => {
    const header = [
      t.dash.rent.apartment,
      t.dash.rent.tenantName,
      t.dash.rent.cycle,
      t.dash.rent.status,
      t.dash.rent.rent,
    ];
    const lines = rows.map((a) => [
      a.label,
      a.tenant!.name,
      cycleLabel(a.cycle, t.dash.rent),
      t.dash.status[a.rentStatus],
      String(a.rent),
    ]);
    const csv = [header, ...lines]
      .map((cols) => cols.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `charta-${building.id}-2026-08.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    notify(t.dash.rent.exported);
  };

  return (
    <>
      {/* The same four figures the tenant directory leads with, so the two
          screens answer the same question the same way. */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          emphasis
          label={t.dash.rent.kpiCollected}
          value={fmt(collected)}
          hint={t.dash.rent.kpiThisYear}
        />
        <StatCard
          label={t.dash.rent.kpiOutstanding}
          value={fmt(outstanding)}
          hint={t.dash.rent.kpiAllPeriods}
        />
        <StatCard
          label={t.dash.rent.kpiBehind}
          value={String(behind)}
          hint={f(t.dash.rent.kpiOfLeased, { count: leased.length })}
        />
        <StatCard
          label={t.dash.rent.kpiExpected}
          value={fmt(due)}
          hint={t.dash.rent.kpiPerCycle}
        />
      </div>

      <PageTitle
        title={t.dash.rent.title}
        subtitle={f(t.dash.rent.subtitle, {
          building: building.name,
          collected: fmt(collected),
          due: fmt(due),
        })}
        action={
          <div className="flex items-center gap-3">
            <button
              onClick={exportCsv}
              className="flex items-center gap-2 rounded-full border border-azure-900/15 px-5 py-3 text-sm font-semibold text-azure-950 transition hover:bg-azure-900/5 dark:border-white/15 dark:text-white dark:hover:bg-white/10"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 3v12M8 11l4 4 4-4M4 21h16" />
              </svg>
              {t.dash.rent.export}
            </button>
            <button
              onClick={() => setRecording(true)}
              className="rounded-full bg-onyx px-6 py-3 text-sm font-semibold text-white transition hover:bg-azure-900 dark:bg-soft-500 dark:text-azure-950 dark:hover:bg-soft-400"
            >
              {t.dash.rent.recordPayment}
            </button>
          </div>
        }
      />

      <Tabs tabs={tabs} active={tab} onChange={setTab} />

      {tab === "reminders" ? (
        <RemindersPanel />
      ) : tab === "tenants" ? (
        <TenantsPanel />
      ) : (
      <div className="rounded-3xl border border-white/70 bg-white/55 shadow-lg shadow-azure-900/5 backdrop-blur-2xl dark:border-white/10 dark:bg-white/[0.05] dark:shadow-none">
        <div className="flex flex-wrap items-center justify-between gap-4 p-6">
          <p className="text-lg font-bold text-azure-950 dark:text-white">
            {t.dash.rent.leases}{" "}
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
                className="w-40 bg-transparent text-sm text-azure-950 outline-none placeholder:text-onyx/35 dark:text-white dark:placeholder:text-white/35"
              />
            </div>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as StatusFilter)}
              className={selectCls}
              aria-label={t.dash.common.allStatuses}
            >
              {statuses.map((x) => (
                <option key={x.key} value={x.key}>
                  {x.label} ({x.count})
                </option>
              ))}
            </select>
            <button
              onClick={() => {
                setStatus("all");
                setSearch("");
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

        <div className="overflow-x-auto">
          <table className="w-full min-w-[880px] text-left text-sm">
            <thead>
              <tr className="border-y border-white/60 bg-white/40 text-xs text-onyx/45 dark:border-white/8 dark:bg-white/[0.03] dark:text-white/40">
                <th className="px-6 py-3.5 font-semibold">{t.dash.rent.apartment}</th>
                <th className="py-3.5 font-semibold">{t.dash.rent.reference}</th>
                <th className="py-3.5 font-semibold">{t.dash.rent.cycle}</th>
                <th className="py-3.5 font-semibold">{t.dash.rent.status}</th>
                <th className="py-3.5 font-semibold">{t.dash.rent.tenantName}</th>
                <th className="py-3.5 font-semibold">{t.dash.rent.rent}</th>
                <th className="py-3.5 pr-6 font-semibold">{t.dash.rent.action}</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-10 text-center text-onyx/45 dark:text-white/45">
                    {t.dash.rent.empty}
                  </td>
                </tr>
              )}
              {rows.map((a) => {
                const key = `${building.id}-${a.id}`;
                const wasReminded = remindedKeys.includes(key);
                return (
                  <tr key={key} className="border-b border-azure-900/5 last:border-0 dark:border-white/5">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3.5">
                        {a.photos?.[0]?.src ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={a.photos[0].src}
                            alt={a.label}
                            className="h-12 w-12 shrink-0 rounded-xl object-cover"
                          />
                        ) : (
                          <PhotoPlaceholder className="h-12 w-12 shrink-0 rounded-xl" />
                        )}
                        <div className="min-w-0">
                          <p className="whitespace-nowrap font-bold text-azure-950 dark:text-white">
                            {a.label}
                          </p>
                          <p className="whitespace-nowrap text-xs text-onyx/45 dark:text-white/45">
                            {a.rooms} {a.rooms === 1 ? t.dash.common.room : t.dash.common.rooms} · {a.sqm} m²
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="whitespace-nowrap py-4 pr-4 font-semibold tabular-nums text-azure-950 dark:text-white">
                      {shortRef(a.id)}
                    </td>
                    <td className="py-4 pr-4 text-onyx/60 dark:text-white/60">
                      {cycleLabel(a.cycle, t.dash.rent)}
                    </td>
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
                          href={path(`/dashboard/apartments/${a.id}`)}
                          className="rounded-xl bg-onyx px-5 py-2 text-sm font-semibold text-white transition hover:bg-azure-900 dark:bg-white dark:text-onyx dark:hover:bg-soft-400"
                        >
                          {t.dash.common.view}
                        </Link>
                        {a.rentStatus === "paid" ? (
                          <button
                            onClick={() => {
                              // The receipt is written against a transaction,
                              // not against the current rent: the amount, the
                              // date and the periods all come from what was
                              // actually received.
                              const latest = a.receipts?.[0];
                              setReceipt({
                                tenant: a.tenant!.name,
                                tenantPhone: a.tenant!.phone,
                                apartment: a.label,
                                building: building.name,
                                address: `${building.address}, ${building.city}`,
                                amount: latest?.amount ?? a.rent,
                                periods: latest?.periods ?? [latestPaidPeriod(a)],
                                paidOn: latest?.paidOn ?? "",
                                method: latest?.method,
                                reference:
                                  latest?.reference ||
                                  `RCP-${shortRef(latest?.id ?? a.id)}`,
                              });
                            }}
                            className="rounded-xl border border-azure-900/15 px-4 py-2 text-sm font-semibold text-azure-950 transition hover:bg-azure-900/5 dark:border-white/15 dark:text-white dark:hover:bg-white/10"
                          >
                            {t.dash.rent.receipt}
                          </button>
                        ) : (
                          <button
                            onClick={() =>
                              setReminding({
                                name: a.tenant!.name,
                                phone: a.tenant!.phone,
                                apartment: a.label,
                                amount: a.rent,
                                key,
                                buildingId: building.id,
                                apartmentId: a.id,
                              })
                            }
                            disabled={wasReminded}
                            className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                              wasReminded
                                ? "bg-soft-500/60 text-azure-950/70"
                                : "border border-azure-900/15 text-azure-950 hover:bg-azure-900/5 dark:border-white/15 dark:text-white dark:hover:bg-white/10"
                            }`}
                          >
                            {wasReminded ? t.dash.rent.reminded : t.dash.rent.remind}
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
      )}

      {receipt && <ReceiptModal receipt={receipt} onClose={() => setReceipt(null)} />}

      {reminding && (
        <ReminderModal
          name={reminding.name}
          amount={reminding.amount}
          apartment={reminding.apartment}
          phone={reminding.phone}
          onClose={() => setReminding(null)}
          onSent={() => markReminded(reminding.buildingId, reminding.apartmentId)}
        />
      )}
      {recording && <RecordPaymentModal onClose={() => setRecording(false)} />}
    </>
  );
}
