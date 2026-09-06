"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatMoney } from "@/lib/data";
import { useI18n } from "@/lib/i18n/context";
import { ANNUAL_MONTHS, PLAN_CODES, type PlanCode } from "@/lib/pricing";
import type { AdminAgencyDetail, AdminAgencyRow } from "@/lib/supabase/types";
import { IssueCodeModal, StatusChip } from "./AdminDashboard";
import { AdminShell, Tile, type AdminIdentity } from "./AdminShell";
import { CountryFlag } from "./CountryFlag";

/**
 * One agency, in full, for the desk: who it is, who runs it, what it is on
 * and what that costs where it is, how full it is, what it has collected,
 * every request it has made and every code it has ever been issued. The
 * one action is the same as on the listing, issuing a code, offered here
 * because this is the page the desk is on when it has just checked a
 * receipt against the agency's own numbers.
 */
export function AgencyDetail({ doc, me }: { doc: AdminAgencyDetail; me: AdminIdentity }) {
  const { t, f, locale, path } = useI18n();
  const a = t.admin;
  const d = a.detail;
  const router = useRouter();
  const [issuing, setIssuing] = useState(false);

  const tag = locale === "fr" ? "fr-FR" : "en-GB";
  const day = (iso: string | null | undefined) =>
    iso ? new Date(iso).toLocaleDateString(tag, { day: "numeric", month: "short", year: "numeric" }) : "";
  const clock = (iso: string) =>
    new Date(iso).toLocaleTimeString(tag, { hour: "2-digit", minute: "2-digit" });
  const tierName = (code: string | null | undefined) =>
    code && (PLAN_CODES as readonly string[]).includes(code) ? t.plans.tiers[code as PlanCode].name : (code ?? "");
  const cycleWord = (c: string) => (c === "annual" ? a.annual : a.monthly).toLowerCase();
  const money = (n: number | null | undefined, currency = doc.agency.currency) => formatMoney(Number(n ?? 0), currency);

  const { agency, subscription: sub, members, buildings, money: m, requests, codes } = doc;
  const owner = members.find((x) => x.role === "owner");
  const pending = requests.find((r) => r.status === "pending");

  // The modal was written for a listing row; this is the same agency in
  // that shape, so the desk gets one modal rather than two that drift.
  const asRow: AdminAgencyRow = {
    agency_id: agency.id, agency_name: agency.name, agency_country: agency.country, agency_city: agency.city,
    agency_currency: agency.currency, signed_up_at: agency.joined_at,
    owner_name: owner?.name ?? null, owner_email: owner?.email ?? null, agency_whatsapp: agency.whatsapp,
    member_count: members.length, current_plan: sub?.plan ?? null, plan_status: sub?.status ?? null,
    trial_until: sub?.trial_until ?? null, period_until: sub?.period_until ?? null,
    apartments_used: m.apartments, apartments_max: sub?.max_apartments ?? null,
    collected_total: m.collected_total, collected_year: m.collected_year,
    pending_request_id: pending?.id ?? null, pending_plan: pending?.plan ?? null, pending_cycle: pending?.cycle ?? null,
    pending_amount: pending?.amount ?? null, pending_currency: pending?.currency ?? null, pending_at: pending?.created_at ?? null,
    open_code: codes.find((c) => c.state === "open")?.code ?? null,
    open_code_until: codes.find((c) => c.state === "open")?.expires_at ?? null,
  };

  const card = "rounded-3xl border border-azure-900/10 bg-white/80 p-6 shadow-lg shadow-azure-900/5 backdrop-blur-2xl dark:border-white/10 dark:bg-white/[0.05] dark:shadow-none";
  const label = "text-[11px] font-semibold uppercase tracking-wider text-onyx/40 dark:text-white/35";
  const muted = "text-xs text-onyx/50 dark:text-white/45";
  const notSet = <span className="text-onyx/40 dark:text-white/35">{d.notSet}</span>;

  const plan = sub
    ? sub.monthly_price !== null
      ? f(d.price, { monthly: money(sub.monthly_price), annual: money(sub.annual_price ?? Number(sub.monthly_price) * ANNUAL_MONTHS) })
      : d.onQuote
    : "";

  return (
    <AdminShell me={me} tab="agencies" title={agency.name} subtitle={f(d.joined, { date: day(agency.joined_at) })}>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Link href={path("/admin")} className="text-sm font-semibold text-azure-800 underline-offset-2 hover:underline dark:text-soft-500">
          {d.back}
        </Link>
        <span className="inline-flex items-center gap-2 rounded-full border border-azure-900/15 px-3 py-1 text-xs font-semibold dark:border-white/15">
          <CountryFlag country={agency.country} /> {agency.city} · {agency.country} · {agency.currency}
        </span>
        <button
          type="button"
          onClick={() => setIssuing(true)}
          className="ml-auto rounded-full bg-onyx px-5 py-2.5 text-sm font-bold text-white transition hover:bg-azure-900 dark:bg-soft-500 dark:text-azure-950 dark:hover:bg-soft-400"
        >
          {a.issue}
        </button>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Tile
          label={d.plan}
          value={sub ? tierName(sub.plan) : d.noPlan}
          foot={sub ? `${sub.status === "trialing" && sub.trial_until ? f(a.trialUntil, { date: day(sub.trial_until) }) : sub.period_until ? f(a.activeUntil, { date: day(sub.period_until) }) : ""} · ${plan}` : undefined}
          aside={sub ? <StatusChip status={sub.status} label={a.status[sub.status]} /> : undefined}
        />
        <Tile
          label={a.columns.apartments}
          value={sub?.max_apartments != null ? f(d.ceiling, { used: m.apartments, max: sub.max_apartments }) : f(d.noCeiling, { used: m.apartments })}
          foot={f(d.tenants, { count: m.tenants })}
        />
        <Tile label={d.collectedTotal} value={money(m.collected_total)} foot={m.payments > 0 ? `${f(d.payments, { count: m.payments })} · ${f(d.lastPayment, { date: day(m.last_payment_at) })}` : d.noPayments} />
        <Tile label={d.collectedYear} value={money(m.collected_year)} foot={`${d.collectedMonth} · ${money(m.collected_month)}`} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <section className={card}>
          <p className={label}>{d.identity}</p>
          <dl className="mt-4 space-y-3 text-sm">
            {[
              [d.whatsapp, agency.whatsapp],
              [d.email, agency.email],
              [d.address, agency.address],
              [d.registration, agency.registration],
              [d.locale, agency.locale.toUpperCase()],
            ].map(([k, v]) => (
              <div key={k as string} className="flex items-start justify-between gap-4">
                <dt className={muted}>{k}</dt>
                <dd className="text-right font-semibold">{v || notSet}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className={card}>
          <p className={label}>{d.team}</p>
          <ul className="mt-4 space-y-3 text-sm">
            {members.map((x) => (
              <li key={x.user_id} className="flex items-start justify-between gap-4">
                <span>
                  <span className="block font-semibold">{x.name || x.email || x.user_id.slice(0, 8)}</span>
                  <span className={muted}>{x.email ?? ""}</span>
                </span>
                <span className="text-right">
                  <span className="block text-xs font-bold text-azure-800 dark:text-soft-500">{t.dash.settings.inviteModal.roles[x.role]}</span>
                  <span className={`${muted} block`} suppressHydrationWarning>{f(d.teamJoined, { date: day(x.joined_at) })}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className={card}>
          <p className={label}>{d.buildings}</p>
          {buildings.length === 0 ? <p className={`mt-4 ${muted}`}>{d.noBuildings}</p> : (
            <ul className="mt-4 space-y-3 text-sm">
              {buildings.map((b) => (
                <li key={b.id} className="flex items-start justify-between gap-4">
                  <span>
                    <span className="block font-semibold">{b.name}</span>
                    <span className={muted}>{b.city}</span>
                  </span>
                  <span className="text-right font-semibold">{f(d.buildingLine, { occupied: b.occupied, apartments: b.apartments })}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <section className={card}>
          <p className={label}>{d.requests}</p>
          {requests.length === 0 ? <p className={`mt-4 ${muted}`}>{d.noRequests}</p> : (
            <table className="mt-4 w-full text-left text-sm">
              <tbody>
                {requests.map((r) => (
                  <tr key={r.id} className="border-t border-azure-900/8 dark:border-white/8">
                    <td className="py-3 font-semibold">{tierName(r.plan)} <span className={muted}>{cycleWord(r.cycle)}</span></td>
                    <td className="py-3">{r.amount !== null ? money(r.amount, r.currency) : a.requestQuote.split("·")[1]?.trim()}</td>
                    <td className="py-3"><StatusChip status={r.status === "paid" ? "active" : r.status === "pending" ? "trialing" : "cancelled"} label={d.requestStatus[r.status]} /></td>
                    <td className={`py-3 text-right ${muted}`} suppressHydrationWarning>{day(r.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className={card}>
          <p className={label}>{d.codes}</p>
          {codes.length === 0 ? <p className={`mt-4 ${muted}`}>{d.noCodes}</p> : (
            <table className="mt-4 w-full text-left text-sm">
              <tbody>
                {codes.map((c) => (
                  <tr key={c.code} className="border-t border-azure-900/8 dark:border-white/8">
                    <td className="py-3 font-mono font-bold tracking-[0.15em]">{c.code}</td>
                    <td className="py-3 font-semibold">{tierName(c.plan)} <span className={muted}>{cycleWord(c.cycle)}</span></td>
                    <td className="py-3"><StatusChip status={c.state === "used" ? "active" : c.state === "open" ? "trialing" : "cancelled"} label={d.codeState[c.state]} /></td>
                    <td className={`py-3 text-right ${muted}`} suppressHydrationWarning>
                      <span className="block">{day(c.issued_at)} {c.issued_by ? f(d.issuedBy, { who: c.issued_by }) : ""}</span>
                      <span className="block">
                        {c.state === "used" && c.used_at ? f(d.usedOn, { date: day(c.used_at) })
                          : c.state === "open" ? f(d.expiresAt, { time: clock(c.expires_at) })
                          : f(d.expiredAt, { date: day(c.expires_at) })}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>

      {issuing && <IssueCodeModal row={asRow} onClose={() => { setIssuing(false); router.refresh(); }} />}
    </AdminShell>
  );
}
