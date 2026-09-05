"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Logo } from "@/components/Logo";
import { Field, Modal, ModalActions, fieldCls } from "@/components/dashboard/Modal";
import { formatMoney } from "@/lib/data";
import { useI18n } from "@/lib/i18n/context";
import { PLAN_CODES, type BillingCycle, type PlanCode } from "@/lib/pricing";
import * as admin from "@/lib/supabase/admin-actions";
import type { AdminAgencyRow } from "@/lib/supabase/types";

/**
 * The platform desk.
 *
 * One row per agency: who owns it, what it is on, how full it is, what it
 * has collected, what it has asked for, and whether a code is out. The one
 * action is issuing a code, which is how a mobile money receipt becomes an
 * active plan. The desk sends the code itself, over WhatsApp or by email;
 * nothing is activated without a person having looked at the payment.
 */
export function AdminDashboard({ rows }: { rows: AdminAgencyRow[] }) {
  const { t, f, path, locale } = useI18n();
  const a = t.admin;
  const router = useRouter();
  const [target, setTarget] = useState<AdminAgencyRow | null>(null);

  const tag = locale === "fr" ? "fr-FR" : "en-GB";
  const day = (iso: string) =>
    new Date(iso).toLocaleDateString(tag, { day: "numeric", month: "short", year: "numeric" });
  const clock = (iso: string) =>
    new Date(iso).toLocaleTimeString(tag, { hour: "2-digit", minute: "2-digit" });
  const tierName = (code: string | null) =>
    code && (PLAN_CODES as readonly string[]).includes(code) ? t.plans.tiers[code as PlanCode].name : (code ?? "");

  // Money is summed per currency, because a franc in Conakry and a franc in
  // Douala are not the same franc.
  const totals = new Map<string, number>();
  for (const r of rows) totals.set(r.agency_currency, (totals.get(r.agency_currency) ?? 0) + Number(r.collected_total));
  const active = rows.filter((r) => r.plan_status === "active").length;
  const trialing = rows.filter((r) => r.plan_status === "trialing").length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-white to-soft-100/50 text-azure-950 dark:from-onyx dark:via-onyx dark:to-azure-950 dark:text-white">
      <header className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 pt-6 sm:px-8">
        <span className="dark:hidden"><Logo href={path("/dashboard")} textClassName="text-lg" markClassName="h-8 w-8" /></span>
        <span className="hidden dark:block"><Logo dark href={path("/dashboard")} textClassName="text-lg" markClassName="h-8 w-8" /></span>
        <Link href={path("/dashboard")} className="text-sm font-semibold text-azure-800 hover:underline dark:text-soft-500">
          {t.dash.nav.dashboard}
        </Link>
      </header>

      <main className="mx-auto max-w-7xl px-5 py-10 sm:px-8">
        <h1 className="font-serif text-3xl font-medium tracking-tight sm:text-4xl">{a.title}</h1>
        <p className="mt-1.5 text-[15px] text-onyx/50 dark:text-white/45">{a.subtitle}</p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            [a.kpis.agencies, String(rows.length)],
            [a.kpis.active, String(active)],
            [a.kpis.trialing, String(trialing)],
            [a.kpis.collected, [...totals].map(([c, n]) => formatMoney(n, c)).join(" · ") || "0"],
          ].map(([label, value]) => (
            <div key={label} className="rounded-3xl border border-white/70 bg-white/55 p-5 shadow-lg shadow-azure-900/5 backdrop-blur-2xl dark:border-white/10 dark:bg-white/[0.05] dark:shadow-none">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-onyx/40 dark:text-white/35">{label}</p>
              <p className="mt-1.5 text-xl font-bold">{value}</p>
            </div>
          ))}
        </div>

        <div className="mt-8 overflow-x-auto rounded-3xl border border-white/70 bg-white/55 shadow-lg shadow-azure-900/5 backdrop-blur-2xl dark:border-white/10 dark:bg-white/[0.05] dark:shadow-none">
          <table className="w-full min-w-[1080px] text-left text-sm">
            <thead>
              <tr className="text-[11px] font-semibold uppercase tracking-wider text-onyx/40 dark:text-white/35">
                {[a.columns.agency, a.columns.owner, a.columns.plan, a.columns.apartments, a.columns.collected, a.columns.request, a.columns.code, ""].map((h, i) => (
                  <th key={i} className="px-5 py-4">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr><td colSpan={8} className="px-5 py-10 text-center text-onyx/45 dark:text-white/45">{a.empty}</td></tr>
              )}
              {rows.map((r) => {
                const status = r.plan_status ? a.status[r.plan_status] : a.status.none;
                const until =
                  r.plan_status === "trialing" && r.trial_until ? f(a.trialUntil, { date: day(r.trial_until) })
                  : r.plan_status === "active" && r.period_until ? f(a.activeUntil, { date: day(r.period_until) })
                  : "";
                const request = !r.pending_plan ? a.noRequest
                  : r.pending_amount === null
                    ? f(a.requestQuote, { plan: tierName(r.pending_plan), cycle: r.pending_cycle === "annual" ? a.annual.toLowerCase() : a.monthly.toLowerCase() })
                    : f(a.requestLine, { plan: tierName(r.pending_plan), cycle: r.pending_cycle === "annual" ? a.annual.toLowerCase() : a.monthly.toLowerCase(), amount: formatMoney(Number(r.pending_amount), r.pending_currency ?? r.agency_currency) });
                return (
                  <tr key={r.agency_id} className="border-t border-azure-900/8 align-top dark:border-white/8">
                    <td className="px-5 py-4">
                      <p className="font-bold">{r.agency_name}</p>
                      <p className="text-xs text-onyx/50 dark:text-white/45">{r.agency_city} · {r.agency_country}</p>
                      <p className="text-[11px] text-onyx/40 dark:text-white/35" suppressHydrationWarning>{day(r.signed_up_at)}</p>
                    </td>
                    <td className="px-5 py-4">
                      <p className="font-semibold">{r.owner_name ?? ""}</p>
                      <p className="text-xs text-onyx/50 dark:text-white/45">{r.owner_email ?? ""}</p>
                      <p className="text-[11px] text-onyx/40 dark:text-white/35">{f(a.members, { count: r.member_count })}</p>
                    </td>
                    <td className="px-5 py-4">
                      <p className="font-semibold">{tierName(r.current_plan)}</p>
                      <span className={`mt-1 inline-block rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                        r.plan_status === "active" ? "bg-azure-950 text-white dark:bg-soft-500 dark:text-azure-950"
                        : r.plan_status === "past_due" ? "bg-soft-500 text-azure-950"
                        : "bg-azure-900/8 text-azure-900 dark:bg-white/10 dark:text-white"
                      }`}>{status}</span>
                      {until && <p className="mt-1 text-[11px] text-onyx/50 dark:text-white/45" suppressHydrationWarning>{until}</p>}
                    </td>
                    <td className="px-5 py-4 font-semibold">
                      {r.apartments_used}{r.apartments_max !== null ? ` / ${r.apartments_max}` : ""}
                    </td>
                    <td className="px-5 py-4">
                      <p className="font-semibold">{formatMoney(Number(r.collected_total), r.agency_currency)}</p>
                      <p className="text-[11px] text-onyx/50 dark:text-white/45">{f(a.thisYear, { amount: formatMoney(Number(r.collected_year), r.agency_currency) })}</p>
                    </td>
                    <td className="px-5 py-4">
                      <p className={r.pending_plan ? "font-semibold" : "text-onyx/45 dark:text-white/40"}>{request}</p>
                      {r.pending_at && <p className="text-[11px] text-onyx/50 dark:text-white/45" suppressHydrationWarning>{f(a.requestedOn, { date: day(r.pending_at) })}</p>}
                    </td>
                    <td className="px-5 py-4">
                      {r.open_code ? (
                        <>
                          <p className="font-mono text-base font-bold tracking-[0.2em]">{r.open_code}</p>
                          <p className="text-[11px] text-onyx/50 dark:text-white/45" suppressHydrationWarning>{f(a.openCode, { time: clock(r.open_code_until ?? "") })}</p>
                        </>
                      ) : <span className="text-onyx/45 dark:text-white/40">{a.noCode}</span>}
                    </td>
                    <td className="px-5 py-4">
                      <button
                        type="button"
                        onClick={() => setTarget(r)}
                        className="whitespace-nowrap rounded-full bg-onyx px-4 py-2 text-xs font-bold text-white transition hover:bg-azure-900 dark:bg-soft-500 dark:text-azure-950 dark:hover:bg-soft-400"
                      >
                        {a.issue}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </main>

      {target && (
        <IssueCodeModal
          row={target}
          onClose={() => { setTarget(null); router.refresh(); }}
        />
      )}
    </div>
  );
}

function IssueCodeModal({ row, onClose }: { row: AdminAgencyRow; onClose: () => void }) {
  const { t, f, locale } = useI18n();
  const a = t.admin;
  const tag = locale === "fr" ? "fr-FR" : "en-GB";
  const clock = (iso: string) =>
    new Date(iso).toLocaleString(tag, { hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" });

  const [plan, setPlan] = useState<PlanCode>(row.pending_plan ?? row.current_plan ?? "growth");
  const [cycle, setCycle] = useState<BillingCycle>(row.pending_cycle ?? "monthly");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [issued, setIssued] = useState<{ code: string; validUntil: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [emailed, setEmailed] = useState<string>();
  const [emailing, setEmailing] = useState(false);

  const cycleLabel = cycle === "annual" ? a.annual.toLowerCase() : a.monthly.toLowerCase();
  const message = issued
    ? f(a.message, {
        owner: (row.owner_name ?? "").split(" ")[0] || "",
        agency: row.agency_name,
        plan: t.plans.tiers[plan].name,
        cycle: cycleLabel,
        code: issued.code,
        time: clock(issued.validUntil),
      })
    : "";
  const waDigits = (row.agency_whatsapp ?? "").replace(/\D/g, "");
  const waLink = waDigits ? `https://wa.me/${waDigits}?text=${encodeURIComponent(message)}` : null;

  return (
    <Modal title={f(a.issueTitle, { agency: row.agency_name })} subtitle={a.issueSubtitle} onClose={onClose}>
      {!issued ? (
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError(undefined);
            const result = await admin.issuePlanCode(locale, { agencyId: row.agency_id, plan, cycle });
            setBusy(false);
            if (!result.ok) { setError(result.error); return; }
            setIssued({ code: result.code, validUntil: result.validUntil });
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={a.plan}>
              <select value={plan} onChange={(e) => setPlan(e.target.value as PlanCode)} className={fieldCls}>
                {PLAN_CODES.map((c) => <option key={c} value={c}>{t.plans.tiers[c].name}</option>)}
              </select>
            </Field>
            <Field label={a.cycle}>
              <select value={cycle} onChange={(e) => setCycle(e.target.value as BillingCycle)} className={fieldCls}>
                <option value="monthly">{a.monthly}</option>
                <option value="annual">{a.annual}</option>
              </select>
            </Field>
          </div>
          {error && <p className="text-xs font-semibold text-red-600">{error}</p>}
          <ModalActions onCancel={onClose} submitLabel={busy ? a.generating : a.generate} />
        </form>
      ) : (
        <div className="space-y-4">
          <div className="rounded-2xl bg-soft-100 p-5 text-center dark:bg-white/10">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-azure-800 dark:text-soft-500">{a.codeReady}</p>
            <p className="mt-2 font-mono text-3xl font-bold tracking-[0.35em] text-azure-950 dark:text-white">{issued.code}</p>
            <p className="mt-2 text-xs text-onyx/60 dark:text-white/55">{f(a.validUntil, { time: clock(issued.validUntil) })}</p>
            <button
              type="button"
              onClick={async () => {
                try { await navigator.clipboard.writeText(issued.code); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* clipboard unavailable */ }
              }}
              className="mt-3 rounded-full border border-azure-900/15 px-4 py-1.5 text-xs font-bold text-azure-900 transition hover:bg-white dark:border-white/15 dark:text-white dark:hover:bg-white/10"
            >
              {copied ? a.copied : a.copy}
            </button>
          </div>

          <textarea readOnly value={message} rows={5} className={`${fieldCls} text-xs leading-relaxed`} />

          <div className="flex flex-wrap gap-3">
            {waLink ? (
              <a href={waLink} target="_blank" rel="noreferrer" className="rounded-full bg-onyx px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-azure-900 dark:bg-soft-500 dark:text-azure-950">
                {a.whatsapp}
              </a>
            ) : (
              <span className="self-center text-xs text-onyx/50 dark:text-white/45">{a.noWhatsapp}</span>
            )}
            <button
              type="button"
              disabled={emailing || !row.owner_email}
              onClick={async () => {
                setEmailing(true);
                setError(undefined);
                const result = await admin.emailPlanCode(locale, { agencyId: row.agency_id, code: issued.code, validUntil: issued.validUntil, plan, cycle });
                setEmailing(false);
                if (!result.ok) { setError(result.error); return; }
                setEmailed(result.to);
              }}
              className="rounded-full border border-azure-900/15 px-5 py-2.5 text-sm font-semibold text-azure-900 transition hover:bg-azure-900/5 disabled:opacity-40 dark:border-white/15 dark:text-white dark:hover:bg-white/10"
            >
              {emailing ? a.emailing : emailed ? f(a.emailed, { to: emailed }) : a.email}
            </button>
          </div>
          {error && <p className="text-xs font-semibold text-red-600">{error}</p>}
          <button type="button" onClick={onClose} className="w-full rounded-full border border-azure-900/15 py-3 text-sm font-semibold text-azure-800 dark:border-white/15 dark:text-white">
            {t.dash.common.close}
          </button>
        </div>
      )}
    </Modal>
  );
}
