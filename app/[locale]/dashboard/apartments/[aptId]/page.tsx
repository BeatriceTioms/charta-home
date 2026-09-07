"use client";

import Image from "next/image";
import Link from "next/link";
import { notFound, useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { byPeriodDesc, cycleLabel, type Apartment, type LeaseCycle } from "@/lib/data";
import { useBuilding } from "@/lib/building-context";
import { useStore } from "@/lib/store";
import * as sb from "@/lib/supabase/actions";
import { useMoney } from "@/lib/money";
import { useI18n } from "@/lib/i18n/context";
import { Card, CardTitle, PageTitle, PhotoPlaceholder, RentChip, StatCard, TicketChip } from "@/components/dashboard/ui";
import { Field, Modal, ModalActions, fieldCls } from "@/components/dashboard/Modal";
import { PhotoGallery } from "@/components/dashboard/PhotoGallery";
import { ReminderModal } from "@/components/dashboard/ReminderModal";

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
  const { t, f, locale } = useI18n();
  const { building } = useBuilding();
  const { addLease, notify, agencyId } = useStore();
  const { fmt } = useMoney();
  const m = t.dash.apartment.leaseModal;
  const [error, setError] = useState<string>();
  // A number already in the book belongs to somebody, and reusing it renames
  // them. Said here, while it is being typed, rather than discovered later by
  // reading a tenant name nobody entered.
  const [phone, setPhone] = useState("");
  const [knownAs, setKnownAs] = useState<string>();

  useEffect(() => {
    if (!agencyId || !phone.trim()) {
      setKnownAs(undefined);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      const found = await sb.residentByPhone({ agencyId, phone });
      if (!cancelled) setKnownAs(found?.name);
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [phone, agencyId]);
  // The rent's label names the cycle, so a daily let does not ask for a
  // monthly figure. It is the price agreed with this tenant, which is why it
  // starts at the unit's asking price rather than being fixed to it.
  const [cycle, setCycle] = useState<LeaseCycle>("monthly");

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const name = String(data.get("name") ?? "").trim();
    if (!name) {
      setError(t.dash.common.required);
      return;
    }
    const since = String(data.get("start") ?? "");
    const until = String(data.get("end") ?? "");
    // The database rejects this too, but catching it here says so in French
    // rather than surfacing a Postgres exception.
    if (until && until < since) {
      setError(m.errorEndBeforeStart);
      return;
    }

    addLease(building.id, apartmentId, {
      name,
      phone: String(data.get("phone") ?? ""),
      email: String(data.get("email") ?? ""),
      rent: Number(data.get("rent") ?? defaultRent),
      // Monthly is what nearly every tenancy is. A different term is set on
      // the tenant's own form, once they exist.
      cycle: "monthly",
      since,
      until,
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
          <input
            name="phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder={m.phonePlaceholder}
            className={fieldCls}
          />
        </Field>
        {knownAs && (
          <p className="-mt-1 rounded-2xl bg-soft-200/70 px-4 py-3 text-xs leading-relaxed text-azure-900 dark:bg-white/10 dark:text-white/75">
            {f(m.phoneInUse, { name: knownAs })}
          </p>
        )}
        {/* No cycle here. Almost every tenancy is monthly, so asking made the
            common case answer a question it already knew, and the rare one is
            still reachable: the cycle is on the edit tenant form, where a
            quarterly or yearly term is set once the tenancy exists. */}
        <Field label={m.rent} hint={f(m.rentHint, { asking: fmt(defaultRent) })} hintAfter>
          <input name="rent" type="number" min={0} step={50} defaultValue={defaultRent} className={fieldCls} />
        </Field>
        <Field label={m.email} hint={m.emailHint} hintAfter>
          <input name="email" type="email" inputMode="email" autoComplete="off" placeholder={m.emailPlaceholder} className={fieldCls} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={m.startDate}>
            <input name="start" type="date" defaultValue="2026-09-01" className={fieldCls} />
          </Field>
          <Field label={m.endDate} hint={m.endDateHint} hintAfter>
            <input name="end" type="date" className={fieldCls} />
          </Field>
        </div>
        <ModalActions onCancel={onClose} submitLabel={m.submit} />
      </form>
    </Modal>
  );
}

/** Correct a unit's own details: its name, its size, what it rents for. */
function EditApartmentModal({
  apartment,
  onClose,
}: {
  apartment: Apartment;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const { building } = useBuilding();
  const { updateApartment2, notify } = useStore();
  const m = t.dash.apartment.editModal;
  const [error, setError] = useState<string>();

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const label = String(data.get("label") ?? "").trim();
    if (!label) {
      setError(t.dash.common.required);
      return;
    }
    updateApartment2(building.id, apartment.id, {
      label,
      rooms: Number(data.get("rooms") ?? apartment.rooms),
      bathrooms: Number(data.get("bathrooms") ?? apartment.bathrooms),
      sqm: Number(data.get("sqm") ?? apartment.sqm),
      rent: Number(data.get("rent") ?? apartment.rent),
    });
    notify(m.updated);
    onClose();
  };

  return (
    <Modal title={m.title} subtitle={apartment.label} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <Field label={m.label} error={error}>
          <input name="label" defaultValue={apartment.label} className={fieldCls} />
        </Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label={m.rooms}>
            <input name="rooms" type="number" min={0} defaultValue={apartment.rooms} className={fieldCls} />
          </Field>
          <Field label={m.bathrooms}>
            <input name="bathrooms" type="number" min={0} defaultValue={apartment.bathrooms} className={fieldCls} />
          </Field>
          <Field label={m.sqm}>
            <input name="sqm" type="number" min={0} defaultValue={apartment.sqm} className={fieldCls} />
          </Field>
        </div>
        <Field label={m.rent}>
          <input name="rent" type="number" min={0} defaultValue={apartment.rent} className={fieldCls} />
        </Field>
        <ModalActions onCancel={onClose} submitLabel={t.dash.common.save} />
      </form>
    </Modal>
  );
}

/** Correct the tenant's details and the terms they signed. */
function EditTenantModal({
  apartment,
  onClose,
}: {
  apartment: Apartment;
  onClose: () => void;
}) {
  const { t, f } = useI18n();
  const { building } = useBuilding();
  const { updateTenant, notify } = useStore();
  // Rent is renegotiated mid tenancy often enough that this has to be here,
  // and labelled by the cycle rather than assuming a month.
  const [cycle, setCycle] = useState<LeaseCycle>(apartment.cycle);
  const m = t.dash.apartment.tenantModal;
  const [error, setError] = useState<string>();

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const name = String(data.get("name") ?? "").trim();
    if (!name) {
      setError(t.dash.common.required);
      return;
    }
    updateTenant(building.id, apartment.id, {
      name,
      phone: String(data.get("phone") ?? ""),
      email: String(data.get("email") ?? ""),
      rent: Number(data.get("rent") ?? apartment.rent),
      cycle,
      until: String(data.get("end") ?? ""),
    });
    notify(m.updated);
    onClose();
  };

  return (
    <Modal title={m.title} subtitle={apartment.tenant?.name} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <Field label={m.name} error={error}>
          <input name="name" defaultValue={apartment.tenant?.name} className={fieldCls} />
        </Field>
        <Field label={m.phone}>
          <input name="phone" defaultValue={apartment.tenant?.phone} className={fieldCls} />
        </Field>
        <Field label={m.email} hint={m.emailHint} hintAfter>
          <input name="email" type="email" inputMode="email" defaultValue={apartment.tenant?.email ?? ""} className={fieldCls} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={f(m.rentFor, { cycle: cycleLabel(cycle, t.dash.rent) })}>
            <input name="rent" type="number" min={0} defaultValue={apartment.rent} className={fieldCls} />
          </Field>
          <Field label={m.cycle}>
            <select
              name="cycle"
              value={cycle}
              onChange={(e) => setCycle(e.target.value as LeaseCycle)}
              className={fieldCls}
            >
              {/* Daily and monthly are not renewal terms: a tenancy comes
                  round again on a quarter, a half year or a year. An existing
                  lease on one of the shorter cycles still shows its own value,
                  so opening this form cannot silently change it. */}
              {(cycle === "daily" || cycle === "monthly") && (
                <option value={cycle}>{cycleLabel(cycle, t.dash.rent)}</option>
              )}
              <option value="quarterly">{t.dash.rent.quarterly}</option>
              <option value="semester">{t.dash.rent.semester}</option>
              <option value="yearly">{t.dash.rent.yearly}</option>
            </select>
          </Field>
        </div>
        <Field label={m.endDate} hint={m.endDateHint} hintAfter>
          <input name="end" type="date" className={fieldCls} />
        </Field>
        <ModalActions onCancel={onClose} submitLabel={t.dash.common.save} />
      </form>
    </Modal>
  );
}

export default function ApartmentPage() {
  const { fmt } = useMoney();
  const { building: selected, setBuildingId } = useBuilding();
  const { buildings, tickets, deleteApartment, endLease, notify } = useStore();
  const { t, f, s: ts, path, locale } = useI18n();
  const params = useParams<{ aptId: string }>();
  const router = useRouter();

  const [view, setView] = useState(0);
  const [reminding, setReminding] = useState(false);
  const [leasing, setLeasing] = useState(false);
  const [editingUnit, setEditingUnit] = useState(false);
  const [editingTenant, setEditingTenant] = useState(false);
  const [removingUnit, setRemovingUnit] = useState(false);
  const [endingLease, setEndingLease] = useState(false);
  const [endLeaseError, setEndLeaseError] = useState<string>();

  // A URL names one apartment out of the whole portfolio, so the search is
  // across every building rather than the one currently selected. On a fresh
  // load the selection is still the first building, because the saved choice
  // is only read once the provider has mounted; looking only there turned a
  // reload or a bookmarked unit into a 404.
  const owner = buildings.find((b) => b.apartments.some((a) => a.id === params.aptId));
  const building = owner ?? selected;
  const apartment = building.apartments.find((a) => a.id === params.aptId);

  // Arriving by link also moves the rest of the dashboard to that building,
  // so the sidebar and the switcher agree with the page being read.
  useEffect(() => {
    if (owner && owner.id !== selected.id) setBuildingId(owner.id);
  }, [owner, selected.id, setBuildingId]);

  if (!apartment) notFound();

  const label = apartment.label;
  const aptTickets = tickets.filter(
    (x) => x.buildingId === building.id && x.apartment === apartment.label
  );
  const { activity } = useStore();
  const schedule = activity.filter((a) => a.buildingId === building.id);
  const team = [...new Set(schedule.map((s) => s.who))];

  // Whatever the agency uploaded for this unit, in order.
  const photos = apartment.photos ?? [];
  const shown = photos[Math.min(view, Math.max(0, photos.length - 1))];

  // What the flat has been, from its first lease to today. Every figure is a
  // record; the strip of weekdays that used to sit here was pinned to one
  // week in August 2026 and meant nothing.
  const h = apartment.history;
  const hist = t.dash.apartment.history;
  const dayOf = (iso?: string) =>
    iso ? new Date(iso).toLocaleDateString(locale === "fr" ? "fr-FR" : "en-GB", { day: "numeric", month: "short", year: "numeric" }) : "";
  const tenure = apartment.tenant && apartment.leaseStartsOn
    ? f(hist.occupiedSince, { date: dayOf(apartment.leaseStartsOn) })
    : h.lastLeaseEndedOn
      ? f(hist.vacantSince, { date: dayOf(h.lastLeaseEndedOn) })
      : h.firstLeaseOn ? "" : hist.neverLet;
  const figures: { label: string; value: string; foot?: string }[] = [
    { label: hist.tenantsEver, value: String(h.tenantsEver), foot: h.firstLeaseOn ? f(hist.since, { date: dayOf(h.firstLeaseOn) }) : hist.neverLet },
    { label: hist.collectedLifetime, value: fmt(h.collectedLifetime), foot: h.paymentsCount > 0 ? `${f(hist.payments, { count: h.paymentsCount })} · ${f(hist.lastPayment, { date: dayOf(h.lastPaymentOn) })}` : hist.noPayment },
    { label: hist.collectedYear, value: fmt(apartment.performance.collected), foot: tenure || undefined },
    { label: hist.expensesLifetime, value: fmt(h.expensesLifetime), foot: `${hist.tickets} ${h.ticketsTotal} · ${f(hist.ticketsOpen, { count: h.ticketsOpen })}` },
  ];

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
          {shown ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={shown.src}
              alt={label}
              className="h-14 w-14 rounded-2xl object-cover"
            />
          ) : (
            <PhotoPlaceholder className="h-14 w-14 rounded-2xl" />
          )}
          <div>
            <h1 className="font-serif text-3xl font-medium tracking-tight text-azure-950 dark:text-white sm:text-4xl">
              {label}
            </h1>
            <p className="mt-0.5 flex items-center gap-1.5 text-sm text-onyx/50 dark:text-white/50">
              <svg viewBox="0 0 24 24" className="h-4 w-4 text-azure-600 dark:text-soft-500" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 1118 0z" /><circle cx="12" cy="10" r="3" />
              </svg>
              {building.name} ·{" "}
              {f(t.dash.apartment.renewCycle, {
                cycle: cycleLabel(apartment.cycle, t.dash.rent),
              })}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setEditingUnit(true)}
            className="rounded-full border border-azure-900/15 px-5 py-3 text-sm font-semibold text-azure-950 transition hover:bg-azure-900/5 dark:border-white/15 dark:text-white dark:hover:bg-white/10"
          >
            {t.dash.maintenance.edit}
          </button>
          <button
            onClick={() => setRemovingUnit(true)}
            className="rounded-full border border-azure-900/15 px-5 py-3 text-sm font-semibold text-red-600 transition hover:bg-red-50 dark:border-white/15 dark:hover:bg-red-500/10"
          >
            {t.dash.maintenance.delete}
          </button>
          <button
            onClick={() => (apartment.tenant ? setReminding(true) : setLeasing(true))}
            className="rounded-full bg-onyx px-6 py-3 text-sm font-semibold text-white transition hover:bg-azure-900 dark:bg-soft-500 dark:text-azure-950 dark:hover:bg-soft-400"
          >
            {apartment.tenant ? t.dash.apartment.sendReminder : t.dash.apartment.addLease}
          </button>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.9fr_1fr]">
        <div className="space-y-6">
          {/* interior with working room switcher */}
          <div className="relative overflow-hidden rounded-3xl shadow-sm shadow-azure-800/5">
            {shown ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={shown.src}
                alt={shown.caption ?? label}
                className="aspect-[16/9] w-full object-cover"
              />
            ) : (
              <PhotoPlaceholder className="aspect-[16/9] w-full" />
            )}

            {/* One dot per uploaded photo, and nothing at all below two. */}
            {photos.length > 1 && (
              <div className="absolute left-1/2 top-4 flex -translate-x-1/2 items-center gap-1 rounded-full bg-white/85 p-1.5 backdrop-blur-md">
                {photos.map((photo, i) => (
                  <button
                    key={photo.id}
                    onClick={() => setView(i)}
                    aria-label={photo.caption ?? `${i + 1}`}
                    aria-current={view === i}
                    className={`rounded-full px-4 py-1.5 text-xs font-bold transition ${
                      view === i
                        ? "bg-azure-800 text-white"
                        : "font-semibold text-azure-900/60 hover:text-azure-900"
                    }`}
                  >
                    {photo.caption?.slice(0, 14) || i + 1}
                  </button>
                ))}
              </div>
            )}
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

          {/* Two columns, not four: this grid sits in the narrower of two page
              columns, and a GNF amount needs roughly twice the width a dollar
              figure did. */}
          <div className="grid gap-4 sm:grid-cols-2">
            <StatCard
              emphasis
              label={t.dash.apartment.monthlyRent}
              value={fmt(apartment.rent)}
              hint={f(t.dash.apartment.renewCycle, {
                cycle: cycleLabel(apartment.cycle, t.dash.rent),
              })}
            />
            {/* What this flat returned, from its own money in and out, rather
                than the building's yield repeated on every unit inside it. The
                percentage is what is left of the rent after what the flat cost
                to keep; the hint shows both figures so it can be checked. */}
            <StatCard
              label={t.dash.apartment.netYield}
              value={
                apartment.performance.marginPct === null
                  ? "N/A"
                  : `${apartment.performance.marginPct}%`
              }
              hint={
                apartment.performance.collected > 0
                  ? f(t.dash.apartment.returnHint, {
                      collected: fmt(apartment.performance.collected),
                      spent: fmt(apartment.performance.expenses),
                    })
                  : t.dash.apartment.nothingCollected
              }
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

          <PhotoGallery buildingId={building.id} apartmentId={apartment.id} />

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
                      <th className="pb-3 font-semibold">{t.dash.apartment.statusCol}</th>
                      <th className="pb-3 text-right font-semibold">{t.dash.apartment.proofCol}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...apartment.payments].sort(byPeriodDesc).map((p, i) => (
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
                        <td className="py-3.5">
                          <RentChip status={p.status} />
                        </td>
                        <td className="py-3.5 text-right">
                          {p.proof ? (
                            <a
                              href={p.proof}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 rounded-full border border-azure-900/15 px-3 py-1 text-[11px] font-semibold text-azure-800 transition hover:bg-azure-900/5 dark:border-white/15 dark:text-soft-500 dark:hover:bg-white/10"
                            >
                              <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
                              </svg>
                              {t.dash.apartment.proofCol}
                            </a>
                          ) : (
                            <span className="text-onyx/25 dark:text-white/25">—</span>
                          )}
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
                <div className="mb-4 flex items-center justify-end gap-2">
                  <button
                    onClick={() => setEditingTenant(true)}
                    className="rounded-full border border-azure-900/15 px-3.5 py-1.5 text-xs font-semibold text-azure-950 transition hover:bg-azure-900/5 dark:border-white/15 dark:text-white dark:hover:bg-white/10"
                  >
                    {t.dash.maintenance.edit}
                  </button>
                  <button
                    onClick={() => setEndingLease(true)}
                    className="rounded-full border border-azure-900/15 px-3.5 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-50 dark:border-white/15 dark:hover:bg-red-500/10"
                  >
                    {t.dash.apartment.endLeaseModal.title}
                  </button>
                </div>
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
                    <dt className="shrink-0 text-onyx/45 dark:text-white/45">
                      {t.dash.apartment.phone}
                    </dt>
                    <dd className="min-w-0 text-right font-medium text-azure-950 dark:text-white">
                      <a href={`tel:${apartment.tenant.phone.replace(/\s/g, "")}`} className="hover:underline">
                        {apartment.tenant.phone}
                      </a>
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="shrink-0 text-onyx/45 dark:text-white/45">{t.dash.apartment.email}</dt>
                    <dd className="min-w-0 truncate text-right font-medium text-azure-950 dark:text-white">
                      {apartment.tenant.email ? (
                        <a href={`mailto:${apartment.tenant.email}`} className="hover:underline">{apartment.tenant.email}</a>
                      ) : (
                        <span className="text-onyx/40 dark:text-white/35">{t.dash.apartment.noEmail}</span>
                      )}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-onyx/45 dark:text-white/45">{t.dash.apartment.cycle}</dt>
                    <dd className="font-medium text-azure-950 dark:text-white">
                      {cycleLabel(apartment.cycle, t.dash.rent)}
                    </dd>
                  </div>
                  {apartment.tenant.until && (
                    <div className="flex justify-between gap-3">
                      <dt className="shrink-0 text-onyx/45 dark:text-white/45">
                        {t.dash.apartment.leaseEnds}
                      </dt>
                      <dd className="text-right font-medium text-azure-950 dark:text-white">
                        {apartment.tenant.until}
                      </dd>
                    </div>
                  )}
                  <div className="flex justify-between gap-3">
                    <dt className="shrink-0 text-onyx/45 dark:text-white/45">
                      {t.dash.apartment.rent}
                    </dt>
                    <dd className="min-w-0 text-right font-medium text-azure-950 dark:text-white">
                      {fmt(apartment.rent)}{" "}
                      <span className="whitespace-nowrap">{t.dash.common.perMonth}</span>
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
                {hist.title}
              </h2>
            </div>

            <div className="mt-4 space-y-2">
              {figures.map((x) => (
                <div key={x.label} className="flex items-center justify-between gap-4 rounded-xl border border-azure-900/8 bg-white/50 px-4 py-2.5 dark:border-white/8 dark:bg-white/[0.04]">
                  <span className="min-w-0">
                    <span className="block text-[11px] font-semibold uppercase tracking-wider text-onyx/40 dark:text-white/35">{x.label}</span>
                    {x.foot && <span className="block truncate text-[11px] text-onyx/50 dark:text-white/45" suppressHydrationWarning>{x.foot}</span>}
                  </span>
                  <span className="shrink-0 text-base font-bold text-azure-950 dark:text-white">{x.value}</span>
                </div>
              ))}
            </div>
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
                        <p className="text-sm font-bold">{item.title}</p>
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
                        {x.title}
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
      {editingUnit && (
        <EditApartmentModal apartment={apartment} onClose={() => setEditingUnit(false)} />
      )}

      {editingTenant && apartment.tenant && (
        <EditTenantModal apartment={apartment} onClose={() => setEditingTenant(false)} />
      )}

      {removingUnit && (
        <Modal
          title={t.dash.apartment.deleteModal.title}
          subtitle={
            apartment.tenant
              ? t.dash.apartment.deleteModal.occupied
              : t.dash.apartment.deleteModal.subtitle
          }
          onClose={() => setRemovingUnit(false)}
        >
          <div className="flex gap-3">
            <button
              disabled={Boolean(apartment.tenant)}
              onClick={() => {
                deleteApartment(building.id, apartment.id);
                notify(t.dash.apartment.deleteModal.deleted);
                router.push(path("/dashboard/apartments"));
              }}
              className="flex-1 rounded-full bg-red-600 py-3 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-40"
            >
              {t.dash.maintenance.delete}
            </button>
            <button
              onClick={() => setRemovingUnit(false)}
              className="rounded-full border border-azure-900/15 px-6 py-3 text-sm font-semibold text-azure-800 transition hover:bg-azure-900/5 dark:border-white/15 dark:text-white dark:hover:bg-white/10"
            >
              {t.dash.common.cancel}
            </button>
          </div>
        </Modal>
      )}

      {endingLease && apartment.tenant && (
        <Modal
          title={t.dash.apartment.endLeaseModal.title}
          subtitle={f(t.dash.apartment.endLeaseModal.subtitle, { name: apartment.tenant.name })}
          onClose={() => {
            setEndingLease(false);
            setEndLeaseError(undefined);
          }}
        >
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const endsOn = String(new FormData(e.currentTarget).get("endsOn") ?? "");
              // The database refuses this too, through the dates constraint,
              // but catching it here names the problem instead of failing the
              // save for reasons the agency cannot see.
              if (apartment.leaseStartsOn && endsOn < apartment.leaseStartsOn) {
                setEndLeaseError(
                  f(t.dash.apartment.endLeaseModal.errorBeforeStart, {
                    date: apartment.leaseStartsOn,
                  })
                );
                return;
              }
              const result = await endLease(building.id, apartment.id, endsOn);
              if (!result.ok) {
                setEndLeaseError(
                  result.error === "lease-ends-before-start"
                    ? f(t.dash.apartment.endLeaseModal.errorBeforeStart, {
                        date: apartment.leaseStartsOn ?? "",
                      })
                    : result.error === "lease-not-writable"
                      ? t.dash.apartment.endLeaseModal.errorNotAllowed
                      : (result.error ?? t.dash.common.saveFailed)
                );
                return;
              }
              notify(t.dash.apartment.endLeaseModal.ended);
              setEndingLease(false);
              setEndLeaseError(undefined);
            }}
            className="space-y-4"
          >
            <Field label={t.dash.apartment.endLeaseModal.date} hint={t.dash.apartment.endLeaseModal.hint}>
              <input
                name="endsOn"
                type="date"
                required
                min={apartment.leaseStartsOn}
                defaultValue={new Date().toISOString().slice(0, 10)}
                className={fieldCls}
              />
            </Field>
            {endLeaseError && (
              <p className="rounded-2xl bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-400">
                {endLeaseError}
              </p>
            )}
            <ModalActions
              onCancel={() => {
                setEndingLease(false);
                setEndLeaseError(undefined);
              }}
              submitLabel={t.dash.apartment.endLeaseModal.submit}
            />
          </form>
        </Modal>
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
