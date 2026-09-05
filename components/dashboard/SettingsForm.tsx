"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { COUNTRIES } from "@/lib/countries";
import { useStore } from "@/lib/store";
import { useI18n } from "@/lib/i18n/context";
import { locales } from "@/lib/i18n";
import * as sb from "@/lib/supabase/actions";
import { renderMessage } from "@/lib/whatsapp";
import type { AgencyMember, MemberRole, ReminderRuleRow, ReportChannel } from "@/lib/supabase/types";
import type { getSettingsData } from "@/lib/supabase/queries";
import { Card, CardTitle, PageTitle } from "@/components/dashboard/ui";
import { Field, Modal, ModalActions, fieldCls } from "@/components/dashboard/Modal";
import { formatMoney } from "@/lib/data";
import {
  PLAN_BANDS,
  PLAN_CODES,
  isPricingCountry,
  planForApartments,
  priceFor,
  type BillingCycle,
  type PlanCode,
} from "@/lib/pricing";

type SettingsData = Awaited<ReturnType<typeof getSettingsData>>;

/**
 * Each toggle is one row in reminder_rules. The courtesy reminder's lead time
 * is chosen by the agency, so its offset is negative but not fixed; the other
 * three sit at offsets the product defines.
 */
const FIXED_OFFSETS = { onDue: 0, after: 5, escalation: 10 } as const;
type ReminderKey = "before" | keyof typeof FIXED_OFFSETS;

/** Lead times an agency can pick for the reminder before rent falls due. */
const LEAD_DAYS = [1, 2, 3, 5, 7, 10, 14];
const DEFAULT_LEAD = 3;

/**
 * The sidebar pages an owner can grant. Settings is absent on purpose: it is
 * where a person sets their own name, and its agency fields are owner only
 * already, so withholding it would only strand somebody with a typo in it.
 */
const PAGES = ["dashboard", "apartments", "rent", "maintenance"] as const;

/** What each role gets ticked by default, matching default_pages_for_role. */
const PAGES_BY_ROLE: Record<string, string[]> = {
  owner: ["dashboard", "apartments", "rent", "maintenance"],
  manager: ["dashboard", "apartments", "rent", "maintenance"],
  accountant: ["dashboard", "rent"],
  caretaker: ["dashboard", "maintenance"],
};

/** Tick boxes for the sidebar, used when inviting and when correcting later. */
function PageChoices({
  value,
  onChange,
  disabled,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
}) {
  const { t } = useI18n();
  const labels = t.dash.nav;
  return (
    <div className="flex flex-wrap gap-2">
      {PAGES.map((page) => {
        const on = value.includes(page);
        return (
          <button
            key={page}
            type="button"
            disabled={disabled}
            aria-pressed={on}
            onClick={() =>
              onChange(on ? value.filter((p) => p !== page) : [...value, page])
            }
            className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition disabled:opacity-50 ${
              on
                ? "border-onyx bg-onyx text-white dark:border-soft-500 dark:bg-soft-500 dark:text-azure-950"
                : "border-azure-900/15 text-onyx/60 hover:bg-azure-900/5 dark:border-white/15 dark:text-white/60 dark:hover:bg-white/10"
            }`}
          >
            {labels[page === "dashboard" ? "dashboard" : page === "apartments" ? "apartments" : page === "rent" ? "rent" : "maintenance"]}
          </button>
        );
      })}
    </div>
  );
}

/** What the dispatcher will substitute when the reminder goes out. */
const PLACEHOLDERS = ["tenant", "amount", "period", "days", "agency", "apartment"];

function Toggle({
  on,
  onChange,
  label,
}: {
  on: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition ${
        on ? "bg-soft-500" : "bg-azure-900/15 dark:bg-white/15"
      }`}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
          on ? "left-[1.375rem]" : "left-0.5"
        }`}
      />
    </button>
  );
}

function InviteModal({
  onClose,
  agency,
  agencyId,
  live,
}: {
  onClose: () => void;
  agency: string;
  agencyId: string;
  live: boolean;
}) {
  const { t, f, locale } = useI18n();
  const { notify } = useStore();
  const router = useRouter();
  const m = t.dash.settings.inviteModal;
  const [error, setError] = useState<string>();
  const [sending, setSending] = useState(false);
  const [role, setRole] = useState<MemberRole>("manager");
  const [pages, setPages] = useState<string[]>(PAGES_BY_ROLE.manager);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const email = String(data.get("email") ?? "").trim();
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setError(t.contactPage.form.errorEmail);
      return;
    }

    if (!live) {
      notify(f(m.invited, { email }));
      onClose();
      return;
    }

    setSending(true);
    // The locale decides which language the invitation is written in, so it
    // has to be the one the sender is working in, not a fixed French.
    const result = await sb.inviteMember(locale, { agencyId, email, role, pages });
    setSending(false);
    if (!result.ok) {
      setError(
        result.error === "invite-bad-email"
          ? t.contactPage.form.errorEmail
          : result.error === "only the owner can invite"
            ? m.errorNotOwner
            : result.error.startsWith("invite-email-failed")
              ? m.errorEmailFailed
              : result.error === "invite-site-url-missing"
                ? m.errorSiteUrl
                : result.error
      );
      return;
    }
    notify(f(m.invited, { email }));
    router.refresh();
    onClose();
  };

  return (
    <Modal title={m.title} subtitle={f(m.subtitle, { agency })} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <Field label={m.email} hint={m.emailHint} error={error}>
          <input name="email" type="email" placeholder="collegue@agence.com" className={fieldCls} />
        </Field>
        <Field label={m.role} hint={m.roleHint} hintAfter>
          <select
            name="role"
            value={role}
            onChange={(e) => {
              const next = e.target.value as MemberRole;
              setRole(next);
              // The role suggests the pages; the owner can still adjust them.
              setPages(PAGES_BY_ROLE[next] ?? ["dashboard"]);
            }}
            className={fieldCls}
          >
            <option value="owner">{m.roles.owner}</option>
            <option value="manager">{m.roles.manager}</option>
            <option value="accountant">{m.roles.accountant}</option>
            <option value="caretaker">{m.roles.caretaker}</option>
          </select>
        </Field>

        <Field label={m.pages} hint={m.pagesHint} hintAfter plain>
          <PageChoices value={pages} onChange={setPages} />
        </Field>
        <ModalActions onCancel={onClose} submitLabel={sending ? t.dash.common.saving : m.submit} />
      </form>
    </Modal>
  );
}

/**
 * Writing the reminder in the agency's own words, with a preview so the
 * placeholders are obviously placeholders before anything reaches a tenant.
 */
function MessageModal({
  label,
  value,
  canEdit,
  agencyName,
  leadDays,
  onSave,
  onClose,
}: {
  label: string;
  value: string;
  canEdit: boolean;
  agencyName: string;
  leadDays: number;
  onSave: (next: string) => void;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const m = t.dash.settings.messageModal;
  const [draft, setDraft] = useState(value);

  // Stand ins so the agency sees a real sentence rather than braces.
  const preview = renderMessage(draft, {
    tenant: m.sampleTenant,
    amount: "1 200 000 GNF",
    period: "01/09/2026",
    days: String(leadDays),
    agency: agencyName,
    apartment: m.sampleApartment,
  });

  return (
    <Modal title={m.title} subtitle={label} onClose={onClose}>
      <div className="space-y-4">
        <Field label={m.body} hint={m.placeholderHint}>
          <textarea
            value={draft}
            disabled={!canEdit}
            onChange={(e) => setDraft(e.target.value)}
            rows={5}
            className={`${fieldCls} resize-none leading-relaxed`}
          />
        </Field>

        <div className="flex flex-wrap gap-1.5">
          {PLACEHOLDERS.map((token) => (
            <button
              key={token}
              type="button"
              disabled={!canEdit}
              onClick={() => setDraft((d) => `${d}${d.endsWith(" ") || !d ? "" : " "}{${token}}`)}
              className="rounded-full border border-azure-900/15 px-2.5 py-1 text-[11px] font-semibold text-azure-800 transition hover:bg-azure-900/5 disabled:opacity-50 dark:border-white/15 dark:text-soft-500 dark:hover:bg-white/10"
            >
              {`{${token}}`}
            </button>
          ))}
        </div>

        <div>
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-onyx/40 dark:text-white/40">
            {m.preview}
          </p>
          <p className="rounded-2xl bg-soft-200 px-4 py-3 text-sm leading-relaxed text-azure-950 dark:bg-white/10 dark:text-white">
            {preview}
          </p>
        </div>

        {canEdit ? (
          <div className="flex gap-3">
            <button
              onClick={() => onSave(draft.trim())}
              className="flex-1 rounded-full bg-onyx py-3 text-sm font-semibold text-white transition hover:bg-azure-900 dark:bg-soft-500 dark:text-azure-950 dark:hover:bg-soft-400"
            >
              {t.dash.common.save}
            </button>
            <button
              onClick={onClose}
              className="rounded-full border border-azure-900/15 px-6 py-3 text-sm font-semibold text-azure-800 transition hover:bg-azure-900/5 dark:border-white/15 dark:text-white dark:hover:bg-white/10"
            >
              {t.dash.common.cancel}
            </button>
          </div>
        ) : (
          <button
            onClick={onClose}
            className="w-full rounded-full border border-azure-900/15 py-3 text-sm font-semibold text-azure-800 dark:border-white/15 dark:text-white"
          >
            {t.dash.common.close}
          </button>
        )}
      </div>
    </Modal>
  );
}

/* --------------------------------------------------------------- the plan --
 * What the agency is on and what it may ask for. There is no card form yet:
 * the owner picks a tier and a cycle, the request is recorded and mailed,
 * and the agency pays by mobile money. The subscription itself only moves
 * when the team moves it, so nothing here writes to it.
 */

function PlanSummary({ canEdit, onChoose }: { canEdit: boolean; onChoose: () => void }) {
  const { t, f, locale } = useI18n();
  const { plan, buildings, notify } = useStore();
  const router = useRouter();
  const pc = t.dash.settings.planCard;

  // The code the desk sent after seeing the payment. Checked entirely in the
  // database; this only carries it there and says what came back.
  const [code, setCode] = useState("");
  const [redeeming, setRedeeming] = useState(false);
  const [codeError, setCodeError] = useState<string>();
  const redeem = async () => {
    const trimmed = code.trim();
    if (!trimmed) return;
    setRedeeming(true);
    setCodeError(undefined);
    const result = await sb.redeemPlanCode(locale, trimmed);
    setRedeeming(false);
    if (!result.ok) {
      setCodeError(pc.codeErrors[result.error]);
      return;
    }
    setCode("");
    const tier = t.plans.tiers[result.plan as PlanCode]?.name ?? result.plan;
    notify(f(pc.redeemed, { plan: tier, date: day(result.until) }));
    router.refresh();
  };
  const used = buildings.reduce((n, b) => n + b.apartments.length, 0);
  const day = (iso: string) =>
    new Date(iso).toLocaleDateString(locale === "fr" ? "fr-FR" : "en-GB", {
      day: "numeric", month: "long", year: "numeric",
    });

  const status = !plan ? ""
    : plan.status === "trialing" && plan.trialEndsAt ? f(pc.trialUntil, { date: day(plan.trialEndsAt) })
    : plan.status === "active" && plan.currentPeriodEnd ? f(pc.activeUntil, { date: day(plan.currentPeriodEnd) })
    : plan.status === "active" ? pc.active
    : plan.status === "past_due" ? pc.pastDue
    : plan.status === "cancelled" ? pc.cancelled
    : "";

  const max = plan?.maxApartments ?? null;
  const left = max === null ? null : Math.max(0, max - used);
  const next = plan ? PLAN_CODES[Math.min(PLAN_CODES.indexOf(plan.code) + 1, PLAN_CODES.length - 1)] : null;
  const nextMax = next ? PLAN_BANDS[next].max : null;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-azure-900/10 bg-soft-50 p-5 dark:border-white/10 dark:bg-white/5">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-onyx/40 dark:text-white/35">{pc.current}</p>
        <p className="mt-1 text-lg font-bold text-azure-950 dark:text-white">
          {plan ? t.plans.tiers[plan.code].name : "…"}
        </p>
        {status && (
          <p className="mt-1 text-sm text-onyx/70 dark:text-white/70" suppressHydrationWarning>{status}</p>
        )}
        {plan && (
          <p className="mt-3 text-sm font-semibold text-azure-950 dark:text-white">
            {max === null ? f(pc.apartmentsUnlimited, { used }) : f(pc.apartments, { used, max })}
          </p>
        )}
        {left !== null && left === 0 && (
          <p className="mt-2 rounded-xl bg-azure-950 px-3 py-2 text-xs font-semibold text-white dark:bg-soft-500 dark:text-azure-950">
            {pc.atLimit}
          </p>
        )}
        {left !== null && left > 0 && left <= 5 && nextMax && (
          <p className="mt-2 text-xs text-onyx/60 dark:text-white/55">
            {f(pc.nearLimit, { left, max: nextMax })}
          </p>
        )}
      </div>

      {plan?.pending && (
        <div className="rounded-2xl border border-azure-900/10 bg-white/70 p-5 dark:border-white/10 dark:bg-white/5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-azure-800 dark:text-soft-500">{pc.pendingTitle}</p>
          <p className="mt-1.5 text-sm leading-relaxed text-onyx/70 dark:text-white/70" suppressHydrationWarning>
            {plan.pending.amount === null
              ? f(pc.pendingQuote, {
                  plan: t.plans.tiers[plan.pending.plan].name,
                  date: day(plan.pending.createdAt),
                })
              : f(pc.pending, {
                  plan: t.plans.tiers[plan.pending.plan].name,
                  cycle: plan.pending.cycle === "annual" ? pc.annual : pc.monthly,
                  amount: formatMoney(plan.pending.amount, plan.pending.currency),
                  date: day(plan.pending.createdAt),
                })}
          </p>
        </div>
      )}

      {canEdit && (
        <div className="rounded-2xl border border-azure-900/10 p-4 dark:border-white/10">
          <Field label={pc.codeLabel} hint={pc.codeHint} hintAfter error={codeError}>
            <div className="flex gap-2">
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), redeem())}
                placeholder={pc.codePlaceholder}
                maxLength={8}
                autoComplete="off"
                spellCheck={false}
                className={`${fieldCls} font-mono uppercase tracking-[0.3em]`}
              />
              <button
                type="button"
                onClick={redeem}
                disabled={redeeming || code.trim().length < 8}
                className="shrink-0 rounded-full bg-onyx px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-azure-900 disabled:opacity-40 dark:bg-soft-500 dark:text-azure-950 dark:hover:bg-soft-400"
              >
                {redeeming ? pc.redeeming : pc.redeem}
              </button>
            </div>
          </Field>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={onChoose}
          disabled={!canEdit}
          className="rounded-full bg-onyx px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-azure-900 disabled:opacity-40 dark:bg-soft-500 dark:text-azure-950 dark:hover:bg-soft-400"
        >
          {pc.choose}
        </button>
        {!canEdit && <span className="text-xs text-onyx/50 dark:text-white/45">{pc.ownerOnly}</span>}
      </div>
    </div>
  );
}

function PlanModal({
  agencyId,
  country,
  onClose,
}: {
  agencyId: string;
  country: string;
  onClose: () => void;
}) {
  const { t, f, locale } = useI18n();
  const { plan, buildings, notify } = useStore();
  const router = useRouter();
  const pc = t.dash.settings.planCard;
  const p = t.plans;
  const used = buildings.reduce((n, b) => n + b.apartments.length, 0);
  const recommended = planForApartments(Math.max(1, used));

  const [cycle, setCycle] = useState<BillingCycle>("monthly");
  const [choice, setChoice] = useState<PlanCode>(recommended);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string>();

  const bandOf = (code: PlanCode) => {
    const band = PLAN_BANDS[code];
    return band.max === null ? f(p.bandOpen, { min: band.min }) : f(p.band, { min: band.min, max: band.max });
  };

  return (
    <Modal title={pc.modalTitle} subtitle={pc.modalSubtitle} onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setSending(true);
          setError(undefined);
          const result = await sb.requestPlan(locale, { agencyId, plan: choice, cycle });
          setSending(false);
          if (!result.ok) {
            setError(result.error);
            return;
          }
          notify(pc.sent);
          onClose();
          router.refresh();
        }}
      >
        {!isPricingCountry(country) && (
          <p className="rounded-2xl bg-soft-200/60 px-4 py-3 text-xs leading-relaxed text-azure-900 dark:bg-white/10 dark:text-white/70">
            {f(pc.noPriceList, { country })}
          </p>
        )}

        <div role="radiogroup" aria-label={p.cycleLabel} className="inline-flex rounded-full border border-azure-900/15 p-1 dark:border-white/15">
          {(["monthly", "annual"] as const).map((c) => (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={cycle === c}
              onClick={() => setCycle(c)}
              className={`flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-semibold transition ${
                cycle === c ? "bg-onyx text-white dark:bg-soft-500 dark:text-azure-950" : "text-azure-900 dark:text-white"
              }`}
            >
              {c === "monthly" ? p.monthly : p.annual}
              {c === "annual" && (
                <span className="rounded-full bg-soft-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-azure-950">
                  {p.annualSaving}
                </span>
              )}
            </button>
          ))}
        </div>

        <div role="radiogroup" aria-label={pc.modalTitle} className="space-y-2">
          {PLAN_CODES.map((code) => {
            const price = priceFor(country, code, cycle);
            const active = code === choice;
            const current = plan?.code === code;
            return (
              <button
                key={code}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setChoice(code)}
                className={`flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left transition ${
                  active
                    ? "border-azure-950 bg-azure-950 text-white dark:border-soft-500 dark:bg-soft-500 dark:text-azure-950"
                    : "border-azure-900/10 hover:bg-azure-900/5 dark:border-white/10 dark:hover:bg-white/10"
                }`}
              >
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="text-sm font-bold">{p.tiers[code].name}</span>
                    {current && (
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${active ? "bg-white/20" : "bg-azure-900/10 dark:bg-white/10"}`}>
                        {pc.currentTag}
                      </span>
                    )}
                  </span>
                  <span className={`block text-xs ${active ? "opacity-75" : "text-onyx/50 dark:text-white/45"}`}>
                    {bandOf(code)}
                    {code === recommended && ` · ${f(pc.recommended, { count: used })}`}
                  </span>
                </span>
                <span className="shrink-0 text-right text-sm font-bold">
                  {price ? formatMoney(price.amount, price.currency) : p.quote}
                  {price && (
                    <span className={`block text-[11px] font-medium ${active ? "opacity-75" : "text-onyx/45 dark:text-white/40"}`}>
                      {cycle === "annual" ? p.perYear : p.perMonth}
                    </span>
                  )}
                </span>
              </button>
            );
          })}
        </div>

        {error && <p className="text-xs font-semibold text-red-600">{error}</p>}

        <ModalActions onCancel={onClose} submitLabel={sending ? t.dash.common.saving : pc.send} />
      </form>
    </Modal>
  );
}

export function SettingsForm({ data }: { data: SettingsData }) {
  const { t, f, locale } = useI18n();
  const { notify, currentUser } = useStore();
  const [choosingPlan, setChoosingPlan] = useState(false);
  const router = useRouter();
  const s = t.dash.settings;

  const live = data !== null;
  const agencyId = data?.agency.id ?? "";
  // The agency's name, its number and its currency belong to whoever owns the
  // business. Someone invited in to help run the portfolio keeps every other
  // permission and sees these read only, which is what RLS now enforces too.
  const canEdit = !live || data?.myRole === "owner";
  // Your own name is yours whatever your role, so this is never locked.
  const canEditProfile = true;

  const [agencyName, setAgencyName] = useState(data?.agency.name ?? "Horizon Realty");
  const [whatsapp, setWhatsapp] = useState(data?.agency.whatsapp_number ?? "+224 620 00 00 00");
  const [country, setCountry] = useState(data?.agency.country ?? "Guinea");
  const [city, setCity] = useState(data?.agency.city ?? "Conakry");
  const [currency, setCurrency] = useState(data?.agency.currency ?? "GNF");
  // What a receipt needs and the agency row did not carry. Optional: a blank
  // one leaves the line off the receipt rather than printing somebody else's.
  const [address, setAddress] = useState(data?.agency.address ?? "");
  const [email, setEmail] = useState(data?.agency.email ?? "");
  const [registration, setRegistration] = useState(data?.agency.registration ?? "");

  const rules = data?.reminderRules;
  // The courtesy reminder is whichever rule sits before the due date.
  const beforeRule = rules?.find((r) => r.offset_days < 0);
  const fixedOn = (key: keyof typeof FIXED_OFFSETS) =>
    rules?.some((r) => r.offset_days === FIXED_OFFSETS[key] && r.is_active) ?? true;

  const [reminders, setReminders] = useState({
    before: beforeRule?.is_active ?? true,
    onDue: fixedOn("onDue"),
    after: fixedOn("after"),
    escalation: fixedOn("escalation"),
  });
  const [leadDays, setLeadDays] = useState(
    beforeRule ? Math.abs(beforeRule.offset_days) : DEFAULT_LEAD
  );

  const bodyOf = (key: ReminderKey) => {
    const rule =
      key === "before" ? beforeRule : rules?.find((r) => r.offset_days === FIXED_OFFSETS[key]);
    return rule?.message_body ?? s.messageDefaults[key];
  };
  const [messages, setMessages] = useState<Record<ReminderKey, string>>({
    before: bodyOf("before"),
    onDue: bodyOf("onDue"),
    after: bodyOf("after"),
    escalation: bodyOf("escalation"),
  });
  const [editingMessage, setEditingMessage] = useState<ReminderKey | null>(null);
  // Which channel the reminders go out on. This was three buttons over a
  // hardcoded object: pressing them changed nothing, saved nothing, and was
  // read by nothing. reminder_rules has carried a channel column all along.
  const [channel, setChannel] = useState<ReportChannel>(
    (rules?.find((r) => r.offset_days < 0)?.channel as ReportChannel) ?? "whatsapp"
  );

  const [members, setMembers] = useState<
    { userId?: string; name: string; role: string; email: string; pages: string[] }[]
  >(
    data?.members.length
      ? data.members.map((m: AgencyMember) => ({
          userId: m.user_id,
          name: m.full_name ?? m.email.split("@")[0],
          role: s.inviteModal.roles[m.role],
          email: m.email,
          pages: m.allowed_pages ?? PAGES_BY_ROLE[m.role] ?? ["dashboard"],
        }))
      : [
          { name: "Amina Sow", role: s.inviteModal.roles.owner, email: "amina@horizonrealty.com", pages: [...PAGES] },
          { name: "Karim Diallo", role: s.inviteModal.roles.manager, email: "karim@horizonrealty.com", pages: PAGES_BY_ROLE.manager },
          { name: "Fatou Ba", role: s.inviteModal.roles.caretaker, email: "fatou@horizonrealty.com", pages: PAGES_BY_ROLE.caretaker },
        ]
  );

  /** Correcting what a colleague sees, after they have already been invited. */
  const saveMemberPages = async (userId: string | undefined, next: string[]) => {
    setMembers((list) =>
      list.map((m) => (m.userId === userId ? { ...m, pages: next } : m))
    );
    if (!live || !userId) return;
    const result = await sb.setMemberPages(locale, { agencyId, userId, pages: next });
    if (!result.ok) {
      notify(t.dash.common.saveFailed);
      router.refresh();
    }
  };

  const [inviting, setInviting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [myName, setMyName] = useState(currentUser?.name ?? "");
  const [savingName, setSavingName] = useState(false);

  const saveMyName = async () => {
    const next = myName.trim();
    if (!next || next === currentUser?.name) return;
    setSavingName(true);
    if (live) {
      const result = await sb.updateMyProfile(locale, { agencyId, fullName: next });
      setSavingName(false);
      if (!result.ok) {
        notify(t.dash.common.saveFailed);
        return;
      }
      router.refresh();
    } else {
      setSavingName(false);
    }
    notify(s.profile.saved);
  };

  const save = async () => {
    setSaving(true);

    if (live) {
      const result = await sb.updateAgencySettings(locale, {
        agencyId,
        name: agencyName,
        whatsappNumber: whatsapp,
        country,
        city,
        currency,
        address,
        email,
        registration,
      });
      if (!result.ok) {
        setSaving(false);
        notify(t.dash.common.saveFailed);
        return;
      }

      const ruleResult = await sb.upsertReminderRules(locale, {
        agencyId,
        rules: [
          {
            offsetDays: -leadDays,
            channel,
            isActive: reminders.before,
            escalationStep: 0,
            messageBody: messages.before,
          },
          ...(Object.keys(FIXED_OFFSETS) as (keyof typeof FIXED_OFFSETS)[]).map((key) => ({
            offsetDays: FIXED_OFFSETS[key],
            channel,
            isActive: reminders[key],
            escalationStep: key === "after" ? 1 : key === "escalation" ? 2 : 0,
            messageBody: messages[key],
          })),
        ],
      });
      if (!ruleResult.ok) {
        setSaving(false);
        notify(t.dash.common.saveFailed);
        return;
      }
      router.refresh();
    }

    setTimeout(
      () => {
        setSaving(false);
        setSaved(true);
        notify(s.saveChanges);
        setTimeout(() => setSaved(false), 2500);
      },
      live ? 0 : 500
    );
  };

  const removeMember = async (member: { userId?: string; email: string }) => {
    setMembers((list) => list.filter((x) => x.email !== member.email));
    if (live && member.userId) {
      const result = await sb.removeMember(locale, { agencyId, userId: member.userId });
      if (!result.ok) notify(t.dash.common.saveFailed);
      else router.refresh();
    }
  };

  const switchLanguage = (next: string) => {
    if (next === locale) return;
    document.cookie = `charta-locale=${next};path=/;max-age=31536000;samesite=lax`;
    router.push(`/${next}/dashboard/settings`);
  };

  return (
    <>
      <PageTitle
        title={s.title}
        subtitle={s.subtitle}
        action={
          canEdit && (
            <button
              onClick={save}
              disabled={saving}
              className="rounded-full bg-onyx px-6 py-3 text-sm font-semibold text-white transition hover:bg-azure-900 disabled:opacity-60 dark:bg-soft-500 dark:text-azure-950 dark:hover:bg-soft-400"
            >
              {saving ? t.dash.common.saving : saved ? t.dash.common.saved : s.saveChanges}
            </button>
          )
        }
      />

      <div className="grid gap-6 xl:grid-cols-2">
        {/* the person, not the business */}
        <Card>
          <CardTitle>{s.profile.title}</CardTitle>
          <div className="space-y-4">
            <Field label={s.profile.name} hint={s.profile.nameHint} hintAfter>
              <input
                value={myName}
                disabled={!canEditProfile}
                onChange={(e) => setMyName(e.target.value)}
                onBlur={saveMyName}
                placeholder={s.profile.namePlaceholder}
                className={fieldCls}
              />
            </Field>
            {currentUser?.email && (
              <Field label={s.profile.email}>
                <input value={currentUser.email} disabled readOnly className={fieldCls} />
              </Field>
            )}
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-onyx/50 dark:text-white/45">
                {currentUser ? s.inviteModal.roles[currentUser.role] : ""}
              </span>
              <button
                type="button"
                onClick={saveMyName}
                disabled={savingName || !myName.trim() || myName.trim() === currentUser?.name}
                className="rounded-full bg-onyx px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-azure-900 disabled:opacity-40 dark:bg-soft-500 dark:text-azure-950 dark:hover:bg-soft-400"
              >
                {savingName ? t.dash.common.saving : t.dash.common.save}
              </button>
            </div>
          </div>
        </Card>

        {/* agency */}
        <Card>
          <CardTitle>{s.agency}</CardTitle>
          <div className="space-y-4">
            {!canEdit && (
              <p className="rounded-2xl bg-soft-200/60 px-4 py-3 text-xs leading-relaxed text-azure-900 dark:bg-white/10 dark:text-white/70">
                {s.agencyOwnerOnly}
              </p>
            )}
            <Field label={s.agencyName}>
              <input
                value={agencyName}
                disabled={!canEdit}
                onChange={(e) => setAgencyName(e.target.value)}
                className={fieldCls}
              />
            </Field>
            <Field label={s.whatsappNumber}>
              <input
                value={whatsapp}
                disabled={!canEdit}
                onChange={(e) => setWhatsapp(e.target.value)}
                className={fieldCls}
              />
            </Field>
            <p className="text-xs leading-relaxed text-onyx/50 dark:text-white/45">{s.agencyNote}</p>

            {/* Printed on receipts. A tenant keeps a receipt and may produce
                it later, so these are the agency's own or they are absent. */}
            <Field label={s.address}>
              <input
                value={address}
                disabled={!canEdit}
                onChange={(e) => setAddress(e.target.value)}
                placeholder={s.addressPlaceholder}
                className={fieldCls}
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={s.email}>
                <input
                  value={email}
                  type="email"
                  disabled={!canEdit}
                  onChange={(e) => setEmail(e.target.value)}
                  className={fieldCls}
                />
              </Field>
              <Field label={s.registration}>
                <input
                  value={registration}
                  disabled={!canEdit}
                  onChange={(e) => setRegistration(e.target.value)}
                  placeholder={s.registrationPlaceholder}
                  className={fieldCls}
                />
              </Field>
            </div>
            <p className="text-xs leading-relaxed text-onyx/50 dark:text-white/45">
              {s.receiptNote}
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={s.country}>
                <select
                  value={country}
                  disabled={!canEdit}
                  onChange={(e) => setCountry(e.target.value)}
                  className={fieldCls}
                >
                  {COUNTRIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </Field>
              <Field label={s.city}>
                <input
                  value={city}
                  disabled={!canEdit}
                  onChange={(e) => setCity(e.target.value)}
                  className={fieldCls}
                />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={s.currency}>
                <select
                  value={currency}
                  disabled={!canEdit}
                  onChange={(e) => setCurrency(e.target.value)}
                  className={fieldCls}
                >
                  <option value="GNF">GNF · Franc guinéen</option>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                  <option value="XOF">XOF · Franc CFA (UEMOA)</option>
                  <option value="XAF">XAF · Franc CFA (CEMAC)</option>
                </select>
              </Field>
              <Field label={s.language}>
                <select
                  value={locale}
                  onChange={(e) => switchLanguage(e.target.value)}
                  className={fieldCls}
                >
                  {locales.map((l) => (
                    <option key={l} value={l}>
                      {l === "fr" ? "Français" : "English"}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          </div>
        </Card>

        {/* reminders */}
        <Card>
          <CardTitle>{s.reminders}</CardTitle>
          <p className="-mt-3 mb-5 text-sm text-onyx/50 dark:text-white/45">{s.remindersNote}</p>
          <div className="space-y-4">
            {(
              [
                ["before", s.beforeDue],
                ["onDue", s.onDue],
                ["after", s.afterDue],
                ["escalation", s.escalation],
              ] as const
            ).map(([key, label]) => (
              <div key={key}>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-sm text-onyx/75 dark:text-white/75">{label}</span>
                  <Toggle
                    label={label}
                    on={reminders[key]}
                    onChange={(v) => setReminders((r) => ({ ...r, [key]: v }))}
                  />
                </div>

                {/* The message itself, which the agency writes. Shown only
                    when the reminder is on, since it sends nothing otherwise. */}
                {reminders[key] && (
                  <button
                    type="button"
                    onClick={() => setEditingMessage(key)}
                    className="mt-2 flex w-full items-start gap-2.5 rounded-2xl border border-azure-900/10 bg-azure-900/[0.03] px-4 py-2.5 text-left transition hover:bg-azure-900/[0.06] dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
                  >
                    <svg viewBox="0 0 24 24" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-onyx/40 dark:text-white/40" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 20h9M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z" />
                    </svg>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[11px] font-semibold uppercase tracking-wide text-onyx/40 dark:text-white/40">
                        {s.messageLabel}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-onyx/65 dark:text-white/65">
                        {messages[key]}
                      </span>
                    </span>
                  </button>
                )}

                {/* How far ahead the courtesy reminder goes out. Only shown
                    when it is switched on, since it means nothing otherwise. */}
                {key === "before" && reminders.before && (
                  <label className="mt-2.5 flex items-center justify-between gap-3 rounded-2xl border border-azure-900/10 bg-azure-900/[0.03] px-4 py-2.5 dark:border-white/10 dark:bg-white/5">
                    <span className="text-xs text-onyx/55 dark:text-white/55">{s.leadTime}</span>
                    <select
                      value={leadDays}
                      disabled={!canEdit}
                      onChange={(e) => setLeadDays(Number(e.target.value))}
                      aria-label={s.leadTime}
                      className="rounded-xl border border-azure-900/15 bg-white px-3 py-1.5 text-sm font-semibold text-azure-950 outline-none dark:border-white/15 dark:bg-white/10 dark:text-white dark:[&>option]:bg-onyx"
                    >
                      {LEAD_DAYS.map((d) => (
                        <option key={d} value={d}>
                          {f(d === 1 ? s.leadDayOne : s.leadDays, { count: d })}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </div>
            ))}
          </div>

          <p className="mt-7 text-xs font-semibold uppercase tracking-wide text-onyx/40 dark:text-white/40">
            {s.channels}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {/* One channel, not a set: a reminder goes out once. SMS is absent
                because nothing can send one yet, and a button that records a
                choice nobody can act on is the thing being fixed here. */}
            {(["whatsapp", "email"] as const).map((key) => {
              const on = channel === key;
              return (
                <button
                  key={key}
                  type="button"
                  disabled={!canEdit}
                  onClick={() => setChannel(key)}
                  aria-pressed={on}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition disabled:opacity-50 ${
                    on
                      ? "bg-onyx text-white dark:bg-soft-500 dark:text-azure-950"
                      : "border border-azure-900/15 text-onyx/55 hover:bg-azure-900/5 dark:border-white/15 dark:text-white/55 dark:hover:bg-white/10"
                  }`}
                >
                  {t.dash.maintenance.via[key]}
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-xs leading-relaxed text-onyx/50 dark:text-white/45">
            {s.channelNote}
          </p>
        </Card>

        {/* team */}
        <Card>
          <CardTitle>{s.team}</CardTitle>
          <div className="divide-y divide-azure-900/8 dark:divide-white/8">
            {members.map((m) => {
              // An owner may not narrow their own view, which would be a way
              // to lock the last owner out of the agency's own settings.
              const isSelf = Boolean(m.userId) && m.userId === data?.myUserId;
              return (
                <div key={m.email} className="py-3.5">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-azure-800 text-xs font-bold text-soft-500">
                        {m.name.split(" ").map((w) => w[0]).join("")}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-azure-950 dark:text-white">{m.name}</p>
                        <p className="truncate text-xs text-onyx/45 dark:text-white/45">
                          {m.role} · {m.email}
                        </p>
                      </div>
                    </div>
                    {canEdit && !isSelf && (
                      <button
                        onClick={() => removeMember(m)}
                        className="shrink-0 rounded-full border border-azure-900/15 px-3.5 py-1.5 text-xs font-semibold text-onyx/55 transition hover:bg-azure-900/5 dark:border-white/15 dark:text-white/55 dark:hover:bg-white/10"
                      >
                        {s.remove}
                      </button>
                    )}
                  </div>
                  {canEdit && !isSelf && (
                    <div className="mt-3 pl-13">
                      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-onyx/40 dark:text-white/40">
                        {s.inviteModal.pages}
                      </p>
                      <PageChoices
                        value={m.pages}
                        onChange={(next) => saveMemberPages(m.userId, next)}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {canEdit && (
            <button
              onClick={() => setInviting(true)}
              className="mt-5 w-full rounded-full border border-azure-900/15 py-2.5 text-sm font-semibold text-azure-800 transition hover:bg-azure-900/5 dark:border-white/15 dark:text-soft-500 dark:hover:bg-white/10"
            >
              {s.invite}
            </button>
          )}
        </Card>

        {/* plan */}
        <Card>
          <CardTitle>{s.plan}</CardTitle>
          <PlanSummary canEdit={canEdit} onChoose={() => setChoosingPlan(true)} />
          <p className="mt-5 text-xs leading-relaxed text-onyx/50 dark:text-white/45">{s.dataNotice}</p>
          <ExportButton
            label={s.exportData}
            agencyName={agencyName}
            whatsapp={whatsapp}
            country={country}
            city={city}
            currency={currency}
            notify={notify}
          />
        </Card>
      </div>

      {editingMessage && (
        <MessageModal
          label={
            editingMessage === "before"
              ? s.beforeDue
              : editingMessage === "onDue"
                ? s.onDue
                : editingMessage === "after"
                  ? s.afterDue
                  : s.escalation
          }
          value={messages[editingMessage]}
          canEdit={canEdit}
          agencyName={agencyName}
          leadDays={leadDays}
          onSave={(next) => {
            setMessages((m) => ({ ...m, [editingMessage]: next }));
            setEditingMessage(null);
          }}
          onClose={() => setEditingMessage(null)}
        />
      )}

      {choosingPlan && (
        <PlanModal agencyId={agencyId} country={country} onClose={() => setChoosingPlan(false)} />
      )}

      {inviting && (
        <InviteModal
          agency={agencyName}
          agencyId={agencyId}
          live={live}
          onClose={() => setInviting(false)}
        />
      )}
    </>
  );
}

/**
 * Its own component so it can reach the store's buildings through the normal
 * hook, without the parent function needing to be a hook itself.
 */
function ExportButton({
  label,
  agencyName,
  whatsapp,
  country,
  city,
  currency,
  notify,
}: {
  label: string;
  agencyName: string;
  whatsapp: string;
  country: string;
  city: string;
  currency: string;
  notify: (message: string) => void;
}) {
  const { buildings } = useStore();

  const exportData = () => {
    const payload = {
      exportedAt: new Date().toISOString().slice(0, 10),
      agency: { name: agencyName, whatsapp, country, city, currency },
      buildings,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "charta-home-export.json";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    notify(label);
  };

  return (
    <button
      onClick={exportData}
      className="mt-4 flex w-full items-center justify-center gap-2 rounded-full border border-azure-900/15 py-2.5 text-sm font-semibold text-azure-800 transition hover:bg-azure-900/5 dark:border-white/15 dark:text-soft-500 dark:hover:bg-white/10"
    >
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 3v12M8 11l4 4 4-4M4 21h16" />
      </svg>
      {label}
    </button>
  );
}
