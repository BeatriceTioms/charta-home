"use client";

import Link from "next/link";
import { useState } from "react";
import { formatMoney } from "@/lib/data";
import { convert, type FxCurrency } from "@/lib/fx";
import { useI18n } from "@/lib/i18n/context";
import { ANNUAL_MONTHS, PLAN_CODES, type PlanCode } from "@/lib/pricing";
import type { AdminSubscriptionRow, SubscriptionStatus } from "@/lib/supabase/types";
import { StatusChip } from "./AdminDashboard";
import { AdminShell, Tile, type AdminIdentity } from "./AdminShell";
import { CountryFlag } from "./CountryFlag";
import { CurrencyToggle } from "./CurrencyToggle";

type Filter = "all" | SubscriptionStatus;
const FILTERS: Filter[] = ["all", "active", "trialing", "past_due", "cancelled"];

/**
 * Every subscription on the platform, one row each: where the agency is,
 * what the tier costs there, when it began, when it ends, and every
 * activation that has run through it. The revenue tile is what the active
 * subscriptions would bring in per month at list price, read in whichever
 * currency the desk picks.
 */
export function AdminSubscriptions({ rows, me }: { rows: AdminSubscriptionRow[]; me: AdminIdentity }) {
  const { t, f, locale, path } = useI18n();
  const a = t.admin;
  const s = a.subscriptions;
  const [filter, setFilter] = useState<Filter>("all");
  const [fx, setFx] = useState<FxCurrency>("GNF");

  const tag = locale === "fr" ? "fr-FR" : "en-GB";
  const day = (iso: string | null) =>
    iso ? new Date(iso).toLocaleDateString(tag, { day: "numeric", month: "short", year: "numeric" }) : "";
  const tierName = (code: string | null) =>
    code && (PLAN_CODES as readonly string[]).includes(code) ? t.plans.tiers[code as PlanCode].name : (code ?? "");

  const shown = filter === "all" ? rows : rows.filter((r) => r.plan_status === filter);
  const count = (st: SubscriptionStatus) => rows.filter((r) => r.plan_status === st).length;

  // Monthly at list price for what is active. An annual activation is ten
  // months for twelve, so its month is a twelfth of the year's price.
  const monthly = rows
    .filter((r) => r.plan_status === "active")
    .reduce((sum, r) => {
      const perMonth =
        r.last_activation_cycle === "annual" && r.annual_price !== null
          ? Number(r.annual_price) / 12
          : r.monthly_price !== null ? Number(r.monthly_price) : 0;
      return sum + convert(perMonth, r.agency_currency, fx);
    }, 0);

  const head = [s.columns.agency, a.columns.country, a.columns.currency, s.columns.plan, s.columns.status, s.columns.started, s.columns.trialUntil, s.columns.periodUntil, s.columns.price, s.columns.activations, s.columns.requests];

  return (
    <AdminShell me={me} tab="subscriptions" title={s.title} subtitle={s.subtitle}>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Tile label={a.status.active} value={String(count("active"))} />
        <Tile label={a.status.trialing} value={String(count("trialing"))} />
        <Tile label={a.status.past_due} value={String(count("past_due"))} foot={f(s.cancelledFoot, { count: count("cancelled") })} />
        <Tile
          label={s.monthlyRevenue}
          value={formatMoney(monthly, fx)}
          aside={<CurrencyToggle value={fx} onChange={setFx} />}
        />
      </div>

      <div className="mt-8 flex flex-wrap gap-2">
        {FILTERS.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setFilter(k)}
            className={`rounded-full px-4 py-1.5 text-xs font-bold transition ${
              filter === k
                ? "bg-onyx text-white dark:bg-soft-500 dark:text-azure-950"
                : "border border-azure-900/15 text-onyx/60 hover:text-azure-950 dark:border-white/15 dark:text-white/55 dark:hover:text-white"
            }`}
          >
            {k === "all" ? s.all : a.status[k]} · {k === "all" ? rows.length : count(k)}
          </button>
        ))}
      </div>

      <div className="mt-4 overflow-x-auto rounded-3xl border border-azure-900/10 bg-white/80 shadow-lg shadow-azure-900/5 backdrop-blur-2xl dark:border-white/10 dark:bg-white/[0.05] dark:shadow-none">
        <table className="w-full min-w-[1180px] text-left text-sm">
          <thead>
            <tr className="text-[11px] font-semibold uppercase tracking-wider text-onyx/40 dark:text-white/35">
              {head.map((h, i) => <th key={i} className="px-4 py-4">{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {shown.length === 0 && (
              <tr><td colSpan={head.length} className="px-5 py-10 text-center text-onyx/45 dark:text-white/45">{s.empty}</td></tr>
            )}
            {shown.map((r) => (
              <tr key={r.agency_id} className="border-t border-azure-900/8 align-top dark:border-white/8">
                <td className="px-4 py-4">
                  <Link href={path(`/admin/agencies/${r.agency_id}`)} className="font-bold text-azure-950 underline-offset-2 hover:underline dark:text-white">
                    {r.agency_name}
                  </Link>
                  <p className="text-xs text-onyx/50 dark:text-white/45">{r.owner_name ?? ""}</p>
                  <p className="text-[11px] text-onyx/40 dark:text-white/35">{r.owner_email ?? ""}</p>
                </td>
                <td className="px-4 py-4">
                  <span className="inline-flex items-center gap-2">
                    <CountryFlag country={r.agency_country} />
                    <span className="font-semibold">{r.agency_country}</span>
                  </span>
                  <p className="text-[11px] text-onyx/45 dark:text-white/40">{r.agency_city}</p>
                </td>
                <td className="px-4 py-4 font-semibold">{r.agency_currency}</td>
                <td className="px-4 py-4 font-semibold">{tierName(r.current_plan)}</td>
                <td className="px-4 py-4"><StatusChip status={r.plan_status} label={r.plan_status ? a.status[r.plan_status] : a.status.none} /></td>
                <td className="px-4 py-4" suppressHydrationWarning>{day(r.started_at)}</td>
                <td className="px-4 py-4" suppressHydrationWarning>{day(r.trial_until)}</td>
                <td className="px-4 py-4" suppressHydrationWarning>{day(r.period_until) || <span className="text-onyx/40 dark:text-white/35">{s.noPeriod}</span>}</td>
                <td className="px-4 py-4">
                  {r.monthly_price !== null ? (
                    <>
                      <p className="font-semibold">{formatMoney(Number(r.monthly_price), r.agency_currency)} <span className="text-[11px] font-normal text-onyx/45 dark:text-white/40">{s.perMonth}</span></p>
                      <p className="text-[11px] text-onyx/50 dark:text-white/45">{formatMoney(Number(r.annual_price ?? Number(r.monthly_price) * ANNUAL_MONTHS), r.agency_currency)} {s.perYear}</p>
                    </>
                  ) : <span className="text-onyx/45 dark:text-white/40">{s.onQuote}</span>}
                </td>
                <td className="px-4 py-4">
                  <p className="font-semibold">{r.activations}</p>
                  {r.last_activation_at && (
                    <p className="text-[11px] text-onyx/50 dark:text-white/45" suppressHydrationWarning>
                      {f(s.lastActivation, { plan: tierName(r.last_activation_plan), cycle: (r.last_activation_cycle === "annual" ? a.annual : a.monthly).toLowerCase(), date: day(r.last_activation_at) })}
                    </p>
                  )}
                </td>
                <td className="px-4 py-4 font-semibold">{r.pending_requests}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminShell>
  );
}
