"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { fmt, type RentStatus } from "@/lib/data";
import { useBuilding } from "@/lib/building-context";
import { useStore } from "@/lib/store";
import { useI18n } from "@/lib/i18n/context";
import { PageTitle, RentChip } from "@/components/dashboard/ui";
import { ReceiptModal, type ReceiptData } from "@/components/dashboard/ReceiptModal";
import { Field, Modal, ModalActions, fieldCls } from "@/components/dashboard/Modal";

type Tab = "all" | RentStatus;

function RecordPaymentModal({ onClose }: { onClose: () => void }) {
  const { t, f, s: ts } = useI18n();
  const { building } = useBuilding();
  const { recordPayment, notify } = useStore();
  const m = t.dash.rent.recordModal;

  const owing = building.apartments.filter((a) => a.tenant && a.rentStatus !== "paid");
  const [aptId, setAptId] = useState(owing[0]?.id ?? "");
  const selected = building.apartments.find((a) => a.id === aptId);

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selected) return;
    const data = new FormData(e.currentTarget);
    const amount = Number(data.get("amount") ?? selected.rent);
    recordPayment(building.id, selected.id, {
      amount,
      method: String(data.get("method") ?? "cash"),
      paidOn: String(data.get("date") ?? ""),
      reference: String(data.get("reference") ?? ""),
    });
    notify(f(m.recorded, { amount: fmt(amount) }));
    onClose();
  };

  return (
    <Modal title={m.title} subtitle={m.subtitle} onClose={onClose}>
      {owing.length === 0 ? (
        <p className="text-sm text-onyx/55 dark:text-white/55">{m.noLeases}</p>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <Field label={m.lease}>
            <select
              name="lease"
              value={aptId}
              onChange={(e) => setAptId(e.target.value)}
              className={fieldCls}
            >
              {owing.map((a) => (
                <option key={a.id} value={a.id}>
                  {ts("apartments", a.label)} · {a.tenant!.name} · {fmt(a.rent)}
                </option>
              ))}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={m.amount}>
              <input
                name="amount"
                type="number"
                min={0}
                step={10}
                defaultValue={selected?.rent ?? 0}
                className={fieldCls}
              />
            </Field>
            <Field label={m.date}>
              <input name="date" type="date" defaultValue="2026-08-08" className={fieldCls} />
            </Field>
          </div>
          <Field label={m.method}>
            <select name="method" defaultValue="cash" className={fieldCls}>
              <option value="cash">{m.methods.cash}</option>
              <option value="orange">{m.methods.orange}</option>
              <option value="mtn">{m.methods.mtn}</option>
              <option value="bank">{m.methods.bank}</option>
            </select>
          </Field>
          <Field label={m.reference}>
            <input name="reference" className={fieldCls} />
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

  const [tab, setTab] = useState<Tab>("all");
  const [search, setSearch] = useState("");
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const [recording, setRecording] = useState(false);

  const leased = building.apartments.filter((a) => a.tenant);
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
    { key: "all", label: t.dash.rent.tabs.all },
    { key: "paid", label: t.dash.rent.tabs.paid },
    { key: "pending", label: t.dash.rent.tabs.pending },
    { key: "overdue", label: t.dash.rent.tabs.overdue },
  ];

  const exportCsv = () => {
    const header = [
      t.dash.rent.apartment,
      t.dash.rent.tenantName,
      t.dash.rent.cycle,
      t.dash.rent.status,
      t.dash.rent.rent,
    ];
    const lines = rows.map((a) => [
      ts("apartments", a.label),
      a.tenant!.name,
      a.cycle === "monthly" ? t.dash.rent.monthly : t.dash.rent.yearly,
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

      <div className="mb-6 flex gap-7 overflow-x-auto border-b border-azure-900/10 dark:border-white/10">
        {tabs.map((x) => {
          const active = tab === x.key;
          return (
            <button
              key={x.key}
              onClick={() => setTab(x.key)}
              className={`-mb-px flex shrink-0 items-center gap-2 border-b-2 pb-3 text-[15px] font-semibold transition ${
                active
                  ? "border-azure-800 text-azure-950 dark:border-soft-500 dark:text-white"
                  : "border-transparent text-onyx/45 hover:text-azure-950 dark:text-white/45 dark:hover:text-white"
              }`}
            >
              {x.label}
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                  active
                    ? "bg-soft-500 text-azure-950"
                    : "bg-azure-900/8 text-onyx/50 dark:bg-white/10 dark:text-white/50"
                }`}
              >
                {counts[x.key]}
              </span>
            </button>
          );
        })}
      </div>

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
            <button
              onClick={() => {
                setTab("all");
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
                        <Image
                          src={building.interior}
                          alt={a.label}
                          width={96}
                          height={96}
                          className="h-12 w-12 shrink-0 rounded-xl object-cover"
                        />
                        <div className="min-w-0">
                          <p className="whitespace-nowrap font-bold text-azure-950 dark:text-white">
                            {ts("apartments", a.label)}
                          </p>
                          <p className="whitespace-nowrap text-xs text-onyx/45 dark:text-white/45">
                            {a.rooms} {a.rooms === 1 ? t.dash.common.room : t.dash.common.rooms} · {a.sqm} m²
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 pr-4 font-semibold text-azure-950 dark:text-white">
                      {a.id.toUpperCase()}
                    </td>
                    <td className="py-4 pr-4 text-onyx/60 dark:text-white/60">
                      {a.cycle === "monthly" ? t.dash.rent.monthly : t.dash.rent.yearly}
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
                            onClick={() =>
                              setReceipt({
                                tenant: a.tenant!.name,
                                apartment: ts("apartments", a.label),
                                building: building.name,
                                address: `${building.address}, ${ts("cities", building.city)}`,
                                amount: a.rent,
                                period: "Août 2026",
                                paidOn: "2026-08-02",
                                reference: `RCP-2026-08-${building.id.slice(0, 3).toUpperCase()}-${a.id.toUpperCase()}`,
                              })
                            }
                            className="rounded-xl border border-azure-900/15 px-4 py-2 text-sm font-semibold text-azure-950 transition hover:bg-azure-900/5 dark:border-white/15 dark:text-white dark:hover:bg-white/10"
                          >
                            {t.dash.rent.receipt}
                          </button>
                        ) : (
                          <button
                            onClick={() => {
                              markReminded(building.id, a.id);
                              notify(
                                f(t.dash.apartment.reminderModal.sent, { name: a.tenant!.name })
                              );
                            }}
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

      {receipt && <ReceiptModal receipt={receipt} onClose={() => setReceipt(null)} />}
      {recording && <RecordPaymentModal onClose={() => setRecording(false)} />}
    </>
  );
}
