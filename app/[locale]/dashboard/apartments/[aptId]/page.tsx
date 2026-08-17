"use client";

import Image from "next/image";
import Link from "next/link";
import { notFound, useParams } from "next/navigation";
import { useState } from "react";
import { activity, fmt } from "@/lib/data";
import { useBuilding } from "@/lib/building-context";
import { useStore } from "@/lib/store";
import { useI18n } from "@/lib/i18n/context";
import { Card, CardTitle, PageTitle, RentChip, StatCard, TicketChip } from "@/components/dashboard/ui";
import { Field, Modal, ModalActions, fieldCls } from "@/components/dashboard/Modal";

const WEEK = [
  { day: 5, key: "wed" },
  { day: 6, key: "thu" },
  { day: 7, key: "fri" },
  { day: 8, key: "sat", active: true },
  { day: 9, key: "sun" },
  { day: 10, key: "mon" },
  { day: 11, key: "tue" },
];

function ReminderModal({
  name,
  amount,
  apartment,
  phone,
  onClose,
}: {
  name: string;
  amount: number;
  apartment: string;
  phone: string;
  onClose: () => void;
}) {
  const { t, f } = useI18n();
  const { notify } = useStore();
  const m = t.dash.apartment.reminderModal;
  const [channel, setChannel] = useState("whatsapp");

  const message = f(m.message, { name, amount: fmt(amount), apartment });

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (channel === "whatsapp") {
      window.open(
        `https://wa.me/${phone.replace(/\D/g, "")}?text=${encodeURIComponent(message)}`,
        "_blank",
        "noopener"
      );
    } else if (channel === "sms") {
      window.location.href = `sms:${phone.replace(/\s/g, "")}?body=${encodeURIComponent(message)}`;
    } else {
      window.location.href = `mailto:?subject=${encodeURIComponent(m.title)}&body=${encodeURIComponent(message)}`;
    }
    notify(f(m.sent, { name }));
    onClose();
  };

  return (
    <Modal title={m.title} subtitle={f(m.subtitle, { name })} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <Field label={m.channel}>
          <select value={channel} onChange={(e) => setChannel(e.target.value)} className={fieldCls}>
            <option value="whatsapp">{m.whatsapp}</option>
            <option value="sms">{m.sms}</option>
            <option value="email">{m.email}</option>
          </select>
        </Field>
        <Field label={m.preview}>
          <p className="rounded-2xl border border-azure-900/10 bg-soft-50 p-4 text-sm leading-relaxed text-onyx/75 dark:border-white/10 dark:bg-white/5 dark:text-white/70">
            {message}
          </p>
        </Field>
        <ModalActions onCancel={onClose} submitLabel={m.submit} />
      </form>
    </Modal>
  );
}

function LeaseModal({
  apartmentId,
  apartmentLabel,
  defaultRent,
  onClose,
}: {
  apartmentId: string;
  apartmentLabel: string;
  defaultRent: number;
  onClose: () => void;
}) {
  const { t, f } = useI18n();
  const { building } = useBuilding();
  const { addLease, notify } = useStore();
  const m = t.dash.apartment.leaseModal;
  const [error, setError] = useState<string>();

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const name = String(data.get("name") ?? "").trim();
    if (!name) {
      setError(t.dash.common.required);
      return;
    }
    addLease(building.id, apartmentId, {
      name,
      phone: String(data.get("phone") ?? ""),
      rent: Number(data.get("rent") ?? defaultRent),
      cycle: (data.get("cycle") as "monthly" | "yearly") ?? "monthly",
      since: String(data.get("start") ?? ""),
    });
    notify(`${name} · ${m.submit}`);
    onClose();
  };

  return (
    <Modal
      title={m.title}
      subtitle={f(m.subtitle, { apartment: apartmentLabel })}
      onClose={onClose}
    >
      <form onSubmit={submit} className="space-y-4">
        <Field label={m.tenantName} error={error}>
          <input name="name" placeholder={m.tenantPlaceholder} className={fieldCls} />
        </Field>
        <Field label={m.phone}>
          <input name="phone" placeholder={m.phonePlaceholder} className={fieldCls} />
        </Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label={m.rent}>
            <input name="rent" type="number" min={0} step={50} defaultValue={defaultRent} className={fieldCls} />
          </Field>
          <Field label={m.cycle}>
            <select name="cycle" defaultValue="monthly" className={fieldCls}>
              <option value="monthly">{t.dash.rent.monthly}</option>
              <option value="yearly">{t.dash.rent.yearly}</option>
            </select>
          </Field>
          <Field label={m.startDate}>
            <input name="start" type="date" defaultValue="2026-09-01" className={fieldCls} />
          </Field>
        </div>
        <ModalActions onCancel={onClose} submitLabel={m.submit} />
      </form>
    </Modal>
  );
}

export default function ApartmentPage() {
  const { building } = useBuilding();
  const { tickets } = useStore();
  const { t, f, s: ts, path, locale } = useI18n();
  const params = useParams<{ aptId: string }>();

  const [view, setView] = useState<"living" | "kitchen" | "bedrooms">("living");
  const [reminding, setReminding] = useState(false);
  const [leasing, setLeasing] = useState(false);

  const apartment = building.apartments.find((a) => a.id === params.aptId);
  if (!apartment) notFound();

  const label = ts("apartments", apartment.label);
  const aptTickets = tickets.filter(
    (x) => x.buildingId === building.id && x.apartment === apartment.label
  );
  const schedule = activity.filter((a) => a.buildingId === building.id);
  const team = [...new Set(schedule.map((s) => s.who))];

  const PHOTOS: Record<typeof view, string> = {
    living: building.interior,
    kitchen: "/photos/interior-4.jpg",
    bedrooms: "/photos/interior-1.jpg",
  };

  const weekdays = WEEK.map((d) => ({
    ...d,
    label: new Date(2026, 7, d.day).toLocaleDateString(locale === "fr" ? "fr-FR" : "en-GB", {
      weekday: "short",
    }),
  }));

  return (
    <>
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link
            href={path("/dashboard/apartments")}
            aria-label={t.dash.apartment.backToApartments}
            className="grid h-11 w-11 place-items-center rounded-full border border-azure-900/10 text-azure-950 transition hover:bg-azure-900/10 dark:border-white/10 dark:text-white dark:hover:bg-white/10"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M11 18l-6-6 6-6" />
            </svg>
          </Link>
          <Image
            src={building.interior}
            alt={label}
            width={112}
            height={112}
            className="h-14 w-14 rounded-2xl object-cover"
          />
          <div>
            <h1 className="font-serif text-3xl font-medium tracking-tight text-azure-950 dark:text-white sm:text-4xl">
              {label}
            </h1>
            <p className="mt-0.5 flex items-center gap-1.5 text-sm text-onyx/50 dark:text-white/50">
              <svg viewBox="0 0 24 24" className="h-4 w-4 text-azure-600 dark:text-soft-500" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 1118 0z" /><circle cx="12" cy="10" r="3" />
              </svg>
              {building.name} ·{" "}
              {f(t.dash.apartment.leaseCycle, {
                cycle: apartment.cycle === "monthly" ? t.dash.rent.monthly : t.dash.rent.yearly,
              })}
            </p>
          </div>
        </div>
        <button
          onClick={() => (apartment.tenant ? setReminding(true) : setLeasing(true))}
          className="rounded-full bg-onyx px-6 py-3 text-sm font-semibold text-white transition hover:bg-azure-900 dark:bg-soft-500 dark:text-azure-950 dark:hover:bg-soft-400"
        >
          {apartment.tenant ? t.dash.apartment.sendReminder : t.dash.apartment.addLease}
        </button>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.9fr_1fr]">
        <div className="space-y-6">
          {/* interior with working room switcher */}
          <div className="relative overflow-hidden rounded-3xl shadow-sm shadow-azure-800/5">
            <Image
              src={PHOTOS[view]}
              alt={label}
              width={1600}
              height={1067}
              className="aspect-[16/9] w-full object-cover"
            />
            <div className="absolute left-1/2 top-4 flex -translate-x-1/2 items-center gap-1 rounded-full bg-white/85 p-1.5 backdrop-blur-md">
              {(["living", "kitchen", "bedrooms"] as const).map((key) => (
                <button
                  key={key}
                  onClick={() => setView(key)}
                  className={`rounded-full px-4 py-1.5 text-xs font-bold transition ${
                    view === key
                      ? "bg-azure-800 text-white"
                      : "font-semibold text-azure-900/60 hover:text-azure-900"
                  }`}
                >
                  {t.dash.apartment.views[key]}
                </button>
              ))}
            </div>
            <div className="absolute inset-x-4 bottom-4 grid max-w-sm grid-cols-3 gap-2">
              {[
                [String(apartment.rooms), t.dash.apartment.rooms],
                [String(apartment.bathrooms), t.dash.apartment.bathrooms],
                [String(apartment.sqm), t.dash.apartment.sqmLabel],
              ].map(([v, l]) => (
                <div
                  key={l}
                  className="rounded-2xl bg-onyx/75 px-3 py-2.5 text-center text-white backdrop-blur-sm"
                >
                  <p className="text-xl font-extrabold">{v}</p>
                  <p className="text-[10px] text-white/70">{l}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              emphasis
              label={t.dash.apartment.monthlyRent}
              value={fmt(apartment.rent)}
              hint={f(t.dash.apartment.leaseCycle, {
                cycle: apartment.cycle === "monthly" ? t.dash.rent.monthly : t.dash.rent.yearly,
              })}
            />
            <StatCard
              label={t.dash.apartment.netYield}
              value={apartment.tenant ? `${apartment.netYield}%` : "N/A"}
              hint={apartment.tenant ? t.dash.apartment.yearToDate : t.dash.apartment.currentlyVacant}
            />
            <StatCard
              label={t.dash.apartment.currentStatus}
              value={
                apartment.tenant
                  ? t.dash.status[apartment.rentStatus]
                  : t.dash.status.toLet
              }
              hint={apartment.tenant ? t.dash.apartment.augustRent : t.dash.apartment.noActiveLease}
            />
            <StatCard
              label={t.dash.apartment.openTickets}
              value={String(aptTickets.filter((x) => x.status !== "resolved").length)}
              hint={t.dash.apartment.maintenance}
            />
          </div>

          <Card>
            <CardTitle>{t.dash.apartment.paymentHistory}</CardTitle>
            {apartment.payments.length === 0 ? (
              <p className="text-sm text-onyx/45 dark:text-white/45">{t.dash.apartment.noPayments}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[480px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-azure-900/10 text-xs uppercase tracking-wide text-onyx/40 dark:border-white/10 dark:text-white/40">
                      <th className="pb-3 font-semibold">{t.dash.apartment.period}</th>
                      <th className="pb-3 font-semibold">{t.dash.apartment.amount}</th>
                      <th className="pb-3 font-semibold">{t.dash.apartment.paidOn}</th>
                      <th className="pb-3 text-right font-semibold">{t.dash.apartment.statusCol}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...apartment.payments].reverse().map((p, i) => (
                      <tr
                        key={`${p.month}-${i}`}
                        className="border-b border-azure-900/10 last:border-0 dark:border-white/10"
                      >
                        <td className="py-3.5 font-semibold text-azure-950 dark:text-white">
                          {ts("months", p.month.split(" ")[0])} {p.month.split(" ")[1]}
                        </td>
                        <td className="py-3.5 text-onyx/75 dark:text-white/75">{fmt(p.amount)}</td>
                        <td className="py-3.5 text-onyx/60 dark:text-white/60">
                          {p.paidOn ?? t.dash.apartment.notPaid}
                        </td>
                        <td className="py-3.5 text-right">
                          <RentChip status={p.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardTitle>{t.dash.apartment.tenant}</CardTitle>
            {apartment.tenant ? (
              <div>
                <div className="flex items-center gap-3.5">
                  <span className="grid h-12 w-12 place-items-center rounded-full bg-azure-800 text-sm font-bold text-soft-500">
                    {apartment.tenant.name.split(" ").map((w) => w[0]).join("")}
                  </span>
                  <div>
                    <p className="font-bold text-azure-950 dark:text-white">{apartment.tenant.name}</p>
                    <p className="text-xs text-onyx/45 dark:text-white/45">
                      {f(t.dash.apartment.tenantSince, { date: apartment.tenant.since })}
                    </p>
                  </div>
                </div>
                <dl className="mt-5 space-y-2.5 text-sm">
                  <div className="flex justify-between gap-3">
                    <dt className="text-onyx/45 dark:text-white/45">{t.dash.apartment.phone}</dt>
                    <dd className="font-medium text-azure-950 dark:text-white">
                      <a href={`tel:${apartment.tenant.phone.replace(/\s/g, "")}`} className="hover:underline">
                        {apartment.tenant.phone}
                      </a>
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-onyx/45 dark:text-white/45">{t.dash.apartment.cycle}</dt>
                    <dd className="font-medium text-azure-950 dark:text-white">
                      {apartment.cycle === "monthly" ? t.dash.rent.monthly : t.dash.rent.yearly}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-onyx/45 dark:text-white/45">{t.dash.apartment.rent}</dt>
                    <dd className="font-medium text-azure-950 dark:text-white">
                      {fmt(apartment.rent)} {t.dash.common.perMonth}
                    </dd>
                  </div>
                </dl>
                <a
                  href={`https://wa.me/${apartment.tenant.phone.replace(/\D/g, "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-5 block rounded-full border border-azure-900/15 py-2.5 text-center text-sm font-semibold text-azure-800 transition hover:bg-azure-900/5 dark:border-white/15 dark:text-soft-500 dark:hover:bg-white/10"
                >
                  {t.dash.apartment.messageWhatsApp}
                </a>
              </div>
            ) : (
              <>
                <p className="text-sm text-onyx/45 dark:text-white/45">{t.dash.apartment.vacantBody}</p>
                <button
                  onClick={() => setLeasing(true)}
                  className="mt-5 w-full rounded-full bg-onyx py-2.5 text-sm font-semibold text-white transition hover:bg-azure-900 dark:bg-soft-500 dark:text-azure-950 dark:hover:bg-soft-400"
                >
                  {t.dash.apartment.addLease}
                </button>
              </>
            )}
          </Card>

          <Card>
            <div className="mb-1 flex items-center justify-between">
              <h2 className="text-[15px] font-bold text-azure-950 dark:text-white">
                {t.dash.apartment.buildingActivity}
              </h2>
            </div>

            <div className="mt-4 grid grid-cols-7 gap-1">
              {weekdays.map((d) => (
                <div
                  key={d.day}
                  className={`rounded-2xl py-2.5 text-center ${
                    d.active ? "bg-onyx text-white dark:bg-soft-500 dark:text-azure-950" : "text-onyx/55 dark:text-white/55"
                  }`}
                >
                  <p className="text-sm font-bold">{d.day}</p>
                  <p className={`text-[10px] ${d.active ? "opacity-70" : "text-onyx/35 dark:text-white/35"}`}>
                    {d.label}
                  </p>
                </div>
              ))}
            </div>

            <p className="mt-6 text-xs font-semibold uppercase tracking-wide text-onyx/40 dark:text-white/40">
              {t.dash.apartment.onDuty}
            </p>
            <div className="mt-2.5 flex -space-x-2">
              {team.map((x) => (
                <span
                  key={x}
                  className="grid h-9 w-9 place-items-center rounded-full border-2 border-white bg-azure-800 text-[11px] font-bold text-soft-500 dark:border-onyx"
                >
                  {x}
                </span>
              ))}
            </div>

            <div className="mt-6 space-y-4">
              {schedule.map((item) => (
                <div key={`${item.time}-${item.title}`} className="flex gap-3">
                  <div className="w-12 shrink-0 pt-3 text-right">
                    <p className="text-sm font-bold text-azure-950 dark:text-white">{item.time}</p>
                  </div>
                  <div
                    className={`flex-1 rounded-2xl p-4 ${
                      item.kind === "viewing"
                        ? "bg-soft-200 text-azure-950 dark:bg-white/10 dark:text-white"
                        : "bg-onyx text-white dark:bg-white/[0.06]"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-bold">{ts("activity", item.title)}</p>
                        <p className={`mt-0.5 text-xs ${item.kind === "viewing" ? "opacity-60" : "text-white/65"}`}>
                          {item.detail}
                        </p>
                      </div>
                      <span
                        className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-[10px] font-bold ${
                          item.kind === "viewing" ? "bg-white text-azure-800" : "bg-white/15 text-soft-500"
                        }`}
                      >
                        {item.who}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <CardTitle>{t.dash.apartment.maintenance}</CardTitle>
            {aptTickets.length === 0 ? (
              <p className="text-sm text-onyx/45 dark:text-white/45">{t.dash.apartment.noTickets}</p>
            ) : (
              <div className="space-y-3.5">
                {aptTickets.map((x) => (
                  <div key={x.id} className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold text-azure-950 dark:text-white">
                        {ts("tickets", x.title)}
                      </p>
                      <p className="text-xs text-onyx/45 dark:text-white/45">
                        {f(t.dash.apartment.openedOn, { date: x.openedOn })}
                      </p>
                    </div>
                    <TicketChip status={x.status} />
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>

      {reminding && apartment.tenant && (
        <ReminderModal
          name={apartment.tenant.name}
          amount={apartment.rent}
          apartment={label}
          phone={apartment.tenant.phone}
          onClose={() => setReminding(false)}
        />
      )}
      {leasing && (
        <LeaseModal
          apartmentId={apartment.id}
          apartmentLabel={label}
          defaultRent={apartment.rent}
          onClose={() => setLeasing(false)}
        />
      )}
    </>
  );
}
