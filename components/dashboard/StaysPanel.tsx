"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useBuilding } from "@/lib/building-context";
import { useI18n } from "@/lib/i18n/context";
import { useMoney } from "@/lib/money";
import { useStore } from "@/lib/store";
import * as sb from "@/lib/supabase/actions";
import { Field, Modal, ModalActions, fieldCls } from "@/components/dashboard/Modal";
import type { Stay, StayStatus } from "@/lib/data";

type Filter = "upcoming" | "current" | "past" | "all";

/**
 * Who is staying, and who is coming.
 *
 * Deliberately not the rent table: a stay has no cycle, no arrears and no
 * reminder, so it has its own columns. What it shares with rent is money,
 * which is why what a guest has paid counts towards the unit's year exactly
 * as a tenant's payment does.
 */
export function StaysPanel() {
  const { t, f, locale } = useI18n();
  const { building } = useBuilding();
  const { stays, notify } = useStore();
  const { fmt } = useMoney();
  const router = useRouter();
  const s = t.dash.stays;

  const [filter, setFilter] = useState<Filter>("upcoming");
  const [booking, setBooking] = useState(false);
  const [paying, setPaying] = useState<Stay | null>(null);

  const today = new Date().toISOString().slice(0, 10);
  const mine = useMemo(
    () => stays.filter((x) => x.buildingId === building.id),
    [stays, building.id]
  );

  const groups = useMemo(() => {
    const live = mine.filter((x) => x.status !== "cancelled");
    return {
      current: live.filter((x) => x.checkIn <= today && x.checkOut > today),
      upcoming: live.filter((x) => x.checkIn > today),
      past: live.filter((x) => x.checkOut <= today),
      all: mine,
    };
  }, [mine, today]);

  const rows = [...groups[filter]].sort((a, b) =>
    filter === "past" ? b.checkIn.localeCompare(a.checkIn) : a.checkIn.localeCompare(b.checkIn)
  );

  const day = (iso: string) =>
    new Date(iso).toLocaleDateString(locale === "fr" ? "fr-FR" : "en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });

  const filters: { key: Filter; label: string; count: number }[] = [
    { key: "upcoming", label: s.filters.upcoming, count: groups.upcoming.length },
    { key: "current", label: s.filters.current, count: groups.current.length },
    { key: "past", label: s.filters.past, count: groups.past.length },
    { key: "all", label: s.filters.all, count: groups.all.length },
  ];

  // Only units the agency actually offers by the night can take a booking.
  const bookable = building.apartments.filter((a) => a.shortStay.enabled);

  const nightsOf = (x: Stay) => f(x.nights === 1 ? s.nightOne : s.nights, { count: x.nights });

  return (
    <div className="rounded-3xl border border-white/70 bg-white/55 shadow-lg shadow-azure-900/5 backdrop-blur-2xl dark:border-white/10 dark:bg-white/[0.05] dark:shadow-none">
      <div className="flex flex-wrap items-center justify-between gap-4 p-6">
        <div>
          <p className="text-lg font-bold text-azure-950 dark:text-white">{s.title}</p>
          <p className="mt-0.5 text-sm text-onyx/50 dark:text-white/45">{s.subtitle}</p>
        </div>
        <button
          type="button"
          onClick={() => setBooking(true)}
          disabled={bookable.length === 0}
          className="rounded-full bg-onyx px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-azure-900 disabled:opacity-40 dark:bg-soft-500 dark:text-azure-950 dark:hover:bg-soft-400"
        >
          {s.book}
        </button>
      </div>

      {bookable.length === 0 && (
        <p className="px-6 pb-6 text-sm text-onyx/50 dark:text-white/45">{s.noUnits}</p>
      )}

      <div className="flex flex-wrap gap-2 px-6 pb-4">
        {filters.map((x) => (
          <button
            key={x.key}
            type="button"
            onClick={() => setFilter(x.key)}
            className={`rounded-full px-4 py-1.5 text-xs font-bold transition ${
              filter === x.key
                ? "bg-onyx text-white dark:bg-soft-500 dark:text-azure-950"
                : "border border-azure-900/15 text-onyx/60 hover:text-azure-950 dark:border-white/15 dark:text-white/55 dark:hover:text-white"
            }`}
          >
            {x.label} · {x.count}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[920px] text-left text-sm">
          <thead>
            <tr className="border-y border-white/60 bg-white/40 text-xs text-onyx/45 dark:border-white/8 dark:bg-white/[0.03] dark:text-white/40">
              <th className="px-6 py-3.5 pr-4 font-semibold">{s.columns.guest}</th>
              <th className="py-3.5 pr-4 font-semibold">{s.columns.unit}</th>
              <th className="py-3.5 pr-4 font-semibold">{s.columns.dates}</th>
              <th className="py-3.5 pr-4 font-semibold">{s.columns.nights}</th>
              <th className="py-3.5 pr-4 font-semibold">{s.columns.amount}</th>
              <th className="py-3.5 pr-4 font-semibold">{s.columns.status}</th>
              <th className="py-3.5 pr-6 font-semibold">{t.dash.rent.action}</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-6 py-10 text-center text-onyx/45 dark:text-white/45">
                  {s.empty}
                </td>
              </tr>
            )}
            {rows.map((x) => {
              const owed = x.amount - x.paid;
              return (
                <tr key={x.id} className="border-b border-azure-900/5 last:border-0 dark:border-white/5">
                  <td className="px-6 py-4 pr-4">
                    <p className="font-bold text-azure-950 dark:text-white">{x.guestName}</p>
                    {(x.guestPhone || x.guestEmail) && (
                      <p className="text-xs text-onyx/45 dark:text-white/45">{x.guestPhone ?? x.guestEmail}</p>
                    )}
                  </td>
                  <td className="whitespace-nowrap py-4 pr-4 font-semibold text-azure-950 dark:text-white">
                    {x.apartmentLabel}
                  </td>
                  <td className="whitespace-nowrap py-4 pr-4 text-onyx/70 dark:text-white/70" suppressHydrationWarning>
                    {day(x.checkIn)} → {day(x.checkOut)}
                  </td>
                  <td className="whitespace-nowrap py-4 pr-4 text-onyx/70 dark:text-white/70">{nightsOf(x)}</td>
                  <td className="whitespace-nowrap py-4 pr-4">
                    <p className="font-bold text-azure-950 dark:text-white">{fmt(x.amount)}</p>
                    {owed > 0 ? (
                      <p className="text-xs text-onyx/50 dark:text-white/45">{f(s.owed, { amount: fmt(owed) })}</p>
                    ) : (
                      <p className="text-xs font-semibold text-azure-800 dark:text-soft-500">{s.settled}</p>
                    )}
                  </td>
                  <td className="py-4 pr-4">
                    <StayChip status={x.status} label={s.status[x.status]} />
                  </td>
                  <td className="py-4 pr-6">
                    <button
                      type="button"
                      onClick={() => setPaying(x)}
                      className="whitespace-nowrap rounded-full border border-azure-900/15 px-4 py-1.5 text-xs font-bold text-azure-800 transition hover:bg-azure-900/5 dark:border-white/15 dark:text-soft-500 dark:hover:bg-white/10"
                    >
                      {s.manage}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {booking && <BookStayModal onClose={() => setBooking(false)} />}
      {paying && (
        <ManageStayModal
          stay={paying}
          onClose={() => setPaying(null)}
          onDone={(message) => {
            notify(message);
            setPaying(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function StayChip({ status, label }: { status: StayStatus; label: string }) {
  const tone =
    status === "checked_in"
      ? "bg-azure-950 text-white dark:bg-soft-500 dark:text-azure-950"
      : status === "cancelled"
        ? "bg-azure-900/8 text-onyx/50 dark:bg-white/10 dark:text-white/50"
        : status === "checked_out"
          ? "bg-azure-900/8 text-azure-900 dark:bg-white/10 dark:text-white"
          : "bg-soft-500 text-azure-950";
  return <span className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-bold ${tone}`}>{label}</span>;
}

/** Books a guest in, with the unit's own packages in front of the person. */
function BookStayModal({ onClose }: { onClose: () => void }) {
  const { t, f, locale } = useI18n();
  const { building } = useBuilding();
  const { notify } = useStore();
  const { fmt } = useMoney();
  const router = useRouter();
  const s = t.dash.stays;

  const bookable = building.apartments.filter((a) => a.shortStay.enabled);
  const [apartmentId, setApartmentId] = useState(bookable[0]?.id ?? "");
  const unit = bookable.find((a) => a.id === apartmentId);
  const rates = [...(unit?.shortStay.rates ?? [])].sort((a, b) => a.minNights - b.minNights);

  const today = new Date().toISOString().slice(0, 10);
  const [checkIn, setCheckIn] = useState(today);
  const [checkOut, setCheckOut] = useState("");
  const [amount, setAmount] = useState("");
  const [amountTouched, setAmountTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();

  const nights =
    checkIn && checkOut
      ? Math.max(0, Math.round((Date.parse(checkOut) - Date.parse(checkIn)) / 86_400_000))
      : 0;

  /** Picking a band sets the dates to its shortest stay and prices it. */
  const applyRate = (rateNights: number, pricePerNight: number) => {
    const out = new Date(Date.parse(checkIn) + rateNights * 86_400_000).toISOString().slice(0, 10);
    setCheckOut(out);
    setAmount(String(rateNights * pricePerNight));
  };

  // What the agency charges for the length actually chosen: the band that
  // covers it, or the last one that starts at or below it, which is what
  // the database quotes too.
  const rateFor = (n: number) => {
    const covering = rates.filter((r) => r.minNights <= n && (r.maxNights === null || r.maxNights >= n));
    const below = rates.filter((r) => r.minNights <= n);
    return covering[covering.length - 1] ?? below[below.length - 1] ?? null;
  };

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const guestName = String(data.get("guest") ?? "").trim();
    if (!guestName) {
      setError(t.dash.common.required);
      return;
    }
    if (nights < 1) {
      setError(s.datesOrdered);
      return;
    }
    setSaving(true);
    setError(undefined);
    const result = await sb.createStay(locale, {
      apartmentId,
      guestName,
      guestPhone: String(data.get("phone") ?? ""),
      guestEmail: String(data.get("email") ?? ""),
      checkIn,
      checkOut,
      amount: Number(amount || 0),
      paid: Number(data.get("paid") ?? 0),
      paidOn: today,
      notes: String(data.get("notes") ?? ""),
    });
    setSaving(false);
    if (!result.ok) {
      setError(
        /is taken from/.test(result.error)
          ? result.error
          : result.error === "lease-bad-phone"
            ? t.dash.apartment.leaseModal.errorBadPhone
            : result.error === "lease-bad-email"
              ? t.dash.apartment.leaseModal.errorBadEmail
              : result.error === "stay-dates-ordered"
                ? s.datesOrdered
                : t.dash.common.saveFailed
      );
      return;
    }
    notify(s.booked);
    onClose();
    router.refresh();
  };

  return (
    <Modal title={s.bookTitle} subtitle={s.bookSubtitle} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <Field label={s.columns.unit}>
          <select value={apartmentId} onChange={(e) => setApartmentId(e.target.value)} className={fieldCls}>
            {bookable.map((a) => (
              <option key={a.id} value={a.id}>{a.label}</option>
            ))}
          </select>
        </Field>

        {rates.length > 0 && (
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-onyx/40 dark:text-white/40">
              {s.packages}
            </p>
            <div className="flex flex-wrap gap-2">
              {rates.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => applyRate(r.minNights, r.pricePerNight)}
                  className="rounded-full border border-azure-900/15 px-3 py-1.5 text-xs font-semibold text-azure-800 transition hover:bg-azure-900/5 dark:border-white/15 dark:text-soft-500 dark:hover:bg-white/10"
                >
                  {r.maxNights === null
                    ? f(s.bandOpen, { min: r.minNights })
                    : r.maxNights === r.minNights
                      ? f(r.minNights === 1 ? s.nightOne : s.nights, { count: r.minNights })
                      : f(s.band, { min: r.minNights, max: r.maxNights })}{" "}
                  · {fmt(r.pricePerNight)} {s.perNight}
                </button>
              ))}
            </div>
          </div>
        )}

        <Field label={t.dash.rent.tenantName}>
          <input name="guest" placeholder={s.guestPlaceholder} className={fieldCls} />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={s.checkIn}>
            <input type="date" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} className={fieldCls} />
          </Field>
          <Field
            label={s.checkOut}
            hint={
              nights > 0
                ? rateFor(nights)
                  ? `${f(nights === 1 ? s.nightOne : s.nights, { count: nights })} · ${f(s.atRate, { rate: fmt(rateFor(nights)!.pricePerNight) })}`
                  : f(nights === 1 ? s.nightOne : s.nights, { count: nights })
                : undefined
            }
            hintAfter
          >
            <input type="date" value={checkOut} min={checkIn} onChange={(e) => setCheckOut(e.target.value)} className={fieldCls} />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={s.amount}>
            <input
              type="number"
              min={0}
              value={amount}
              onChange={(e) => { setAmount(e.target.value); setAmountTouched(true); }}
              className={fieldCls}
            />
          </Field>
          <Field label={s.paidNow} hint={s.paidNowHint} hintAfter>
            <input name="paid" type="number" min={0} defaultValue={0} className={fieldCls} />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t.dash.apartment.leaseModal.phone}>
            <input name="phone" placeholder={t.dash.apartment.leaseModal.phonePlaceholder} className={fieldCls} />
          </Field>
          <Field label={t.dash.apartment.leaseModal.email}>
            <input name="email" type="email" placeholder={t.dash.apartment.leaseModal.emailPlaceholder} className={fieldCls} />
          </Field>
        </div>

        <Field label={s.notes}>
          <input name="notes" className={fieldCls} />
        </Field>

        {error && <p className="text-xs font-semibold text-red-600">{error}</p>}
        <ModalActions onCancel={onClose} submitLabel={saving ? t.dash.common.saving : s.book} />
      </form>
    </Modal>
  );
}

/** Money received, and where the stay has got to. */
function ManageStayModal({
  stay,
  onClose,
  onDone,
}: {
  stay: Stay;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const { t, f, locale } = useI18n();
  const { fmt } = useMoney();
  const s = t.dash.stays;
  const [paid, setPaid] = useState(String(stay.paid));
  const [status, setStatus] = useState<StayStatus>(stay.status);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const next = Number(paid || 0);
    if (next > stay.amount) {
      setError(f(s.overPaid, { amount: fmt(stay.amount) }));
      return;
    }
    setSaving(true);
    setError(undefined);
    const result = await sb.updateStay(locale, {
      stayId: stay.id,
      paid: next,
      paidOn: new Date().toISOString().slice(0, 10),
      status,
    });
    setSaving(false);
    if (!result.ok) {
      setError(t.dash.common.saveFailed);
      return;
    }
    onDone(s.updated);
  };

  return (
    <Modal title={s.manageTitle} subtitle={`${stay.apartmentLabel} · ${stay.guestName}`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <Field label={s.amountPaid} hint={f(s.ofAgreed, { amount: fmt(stay.amount) })} hintAfter>
          <input type="number" min={0} max={stay.amount} value={paid} onChange={(e) => setPaid(e.target.value)} className={fieldCls} />
        </Field>
        <Field label={s.columns.status}>
          <select value={status} onChange={(e) => setStatus(e.target.value as StayStatus)} className={fieldCls}>
            {(["booked", "checked_in", "checked_out", "cancelled"] as const).map((k) => (
              <option key={k} value={k}>{s.status[k]}</option>
            ))}
          </select>
        </Field>
        {error && <p className="text-xs font-semibold text-red-600">{error}</p>}
        <ModalActions onCancel={onClose} submitLabel={saving ? t.dash.common.saving : t.dash.common.save} />
      </form>
    </Modal>
  );
}
