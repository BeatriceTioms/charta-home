"use client";

import { useCallback, useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/client";
import { useStore } from "@/lib/store";
import { useMoney } from "@/lib/money";
import { useI18n } from "@/lib/i18n/context";
import { Card, CardTitle } from "@/components/dashboard/ui";

type Booking = {
  id: string;
  status: "submitted" | "reserved" | "reviewing" | "approved";
  move_in: string;
  months: number;
  amount: number | null;
  paid: number;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  apartments: { label: string; buildings: { name: string } | null } | null;
};

const copy = {
  fr: {
    title: "Réservations depuis l’application",
    sub: "Des résidents ont choisi un logement dans l’application. Les réservations payées bloquent ces mois pour tout le monde.",
    paid: "Payé",
    request: "Demande, non payée",
    approved: "Acceptée",
    from: "Entrée le",
    months: "mois",
    accept: "Accepter",
    decline: "Refuser",
    declineAsk: "Refuser cette réservation ? Si elle est payée, remboursez la personne vous-même : les mois redeviennent libres.",
    failed: "La modification n’a pas été enregistrée.",
  },
  en: {
    title: "Bookings from the app",
    sub: "Residents picked a home in the app. Paid bookings hold those months for everyone else.",
    paid: "Paid",
    request: "Request, not paid",
    approved: "Accepted",
    from: "Moves in",
    months: "months",
    accept: "Accept",
    decline: "Decline",
    declineAsk: "Decline this booking? If it was paid, refund the person yourself: the months become free again.",
    failed: "The change was not saved.",
  },
};

/**
 * Monthly rentals booked or requested in the resident app. Hidden when there
 * are none, and in the demo (no database).
 */
export function AppBookings() {
  const { agencyId, currentUser } = useStore();
  const { locale } = useI18n();
  const { fmt } = useMoney();
  const c = copy[locale === "en" ? "en" : "fr"];
  const [rows, setRows] = useState<Booking[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const canDecide = !currentUser || currentUser.role === "owner" || currentUser.role === "manager";

  const load = useCallback(async () => {
    if (!agencyId) return;
    const sb = createClient() as unknown as SupabaseClient;
    const { data } = await sb
      .from("lease_requests")
      .select("id, status, move_in, months, amount, paid, contact_name, contact_email, contact_phone, apartments ( label, buildings ( name ) )")
      .eq("agency_id", agencyId)
      .in("status", ["submitted", "reviewing", "reserved", "approved"])
      .gte("move_in", new Date(Date.now() - 31 * 864e5).toISOString().slice(0, 10))
      .order("move_in")
      .limit(20);
    setRows((data ?? []) as unknown as Booking[]);
  }, [agencyId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function decide(id: string, status: "approved" | "declined") {
    if (status === "declined" && !window.confirm(c.declineAsk)) return;
    setBusy(id);
    setError(null);
    const sb = createClient() as unknown as SupabaseClient;
    const { error: failed } = await sb.from("lease_requests").update({ status }).eq("id", id);
    setBusy(null);
    if (failed) setError(c.failed);
    else await load();
  }

  if (rows.length === 0) return null;
  const date = (d: string) =>
    new Date(`${d}T12:00:00Z`).toLocaleDateString(locale === "en" ? "en-GB" : "fr-FR", { day: "numeric", month: "long", year: "numeric" });

  return (
    <Card>
      <CardTitle>{c.title}</CardTitle>
      <p className="-mt-3 mb-4 text-[13px] text-onyx/45 dark:text-white/45">{c.sub}</p>
      {error && <p className="mb-3 text-sm font-semibold text-red-600">{error}</p>}
      <ul className="divide-y divide-onyx/5 dark:divide-white/10">
        {rows.map((r) => {
          const unit = [r.apartments?.buildings?.name, r.apartments?.label].filter(Boolean).join(" · ");
          const paid = Number(r.paid) > 0;
          return (
            <li key={r.id} className="flex flex-wrap items-center gap-3 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-azure-950 dark:text-white">
                  {r.contact_name || r.contact_email || "—"} · {unit}
                </p>
                <p className="mt-0.5 text-xs text-onyx/50 dark:text-white/50">
                  {c.from} {date(r.move_in)} · {r.months} {c.months}
                  {r.contact_phone ? ` · ${r.contact_phone}` : ""}
                  {r.contact_email ? ` · ${r.contact_email}` : ""}
                </p>
              </div>
              <span
                className={`rounded-full px-3 py-1 text-xs font-bold ${
                  paid ? "bg-azure-900 text-white" : "bg-onyx/5 text-onyx/60 dark:bg-white/10 dark:text-white/60"
                }`}
              >
                {paid ? `${c.paid} ${fmt(Number(r.paid))}` : c.request}
              </span>
              {r.status === "approved" ? (
                <span className="text-xs font-bold text-azure-800 dark:text-soft-500">{c.approved}</span>
              ) : (
                canDecide && (
                  <span className="flex gap-2">
                    <button
                      type="button"
                      disabled={busy === r.id}
                      onClick={() => decide(r.id, "approved")}
                      className="rounded-full bg-onyx px-4 py-1.5 text-xs font-bold text-white disabled:opacity-50 dark:bg-white dark:text-onyx"
                    >
                      {c.accept}
                    </button>
                    <button
                      type="button"
                      disabled={busy === r.id}
                      onClick={() => decide(r.id, "declined")}
                      className="rounded-full border border-onyx/15 px-4 py-1.5 text-xs font-bold text-onyx/70 disabled:opacity-50 dark:border-white/20 dark:text-white/70"
                    >
                      {c.decline}
                    </button>
                  </span>
                )
              )}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
