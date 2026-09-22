"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { COUNTRIES } from "@/lib/countries";
import { useStore } from "@/lib/store";
import { useI18n } from "@/lib/i18n/context";
import { locales } from "@/lib/i18n";
import * as sb from "@/lib/supabase/actions";
import type { AgencyMember, MemberRole } from "@/lib/supabase/types";
import type { getSettingsData } from "@/lib/supabase/queries";
import { Card, CardTitle, PageTitle } from "@/components/dashboard/ui";
import { Field, Modal, ModalActions, fieldCls } from "@/components/dashboard/Modal";
import { formatMoney } from "@/lib/data";
import {
  PLAN_BANDS,
  PLAN_CODES,
  isPlanCode,
  tierName,
  isPricingCountry,
  planForApartments,
  priceFor,
  type BillingCycle,
  type PlanCode,
} from "@/lib/pricing";

type SettingsData = Awaited<ReturnType<typeof getSettingsData>>;

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
function PlanSummary({ canEdit, canPayOnline, onChoose }: { canEdit: boolean; canPayOnline: boolean; onChoose: () => void }) {
  const { t, f, locale } = useI18n();
  const { plan, buildings, notify, agencyInfo } = useStore();
  const router = useRouter();
  const pc = t.dash.settings.planCard;
  const nameOf = (code: PlanCode) => tierName(code, agencyInfo?.country ?? "", t.plans.tiers[code].name);

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
    const tier = isPlanCode(result.plan) ? nameOf(result.plan) : result.plan;
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
  const nextMax = next && next !== plan?.code ? PLAN_BANDS[next].max : null;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-azure-900/10 bg-soft-50 p-5 dark:border-white/10 dark:bg-white/5">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-onyx/40 dark:text-white/35">{pc.current}</p>
        <p className="mt-1 text-lg font-bold text-azure-950 dark:text-white">
          {plan ? nameOf(plan.code) : "…"}
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

      {/* A code is the manual path's receipt. An agency that pays through
          the gateway never receives one, so the field would only puzzle. */}
      {canEdit && !canPayOnline && (
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
  canPayOnline,
  onClose,
}: {
  agencyId: string;
  country: string;
  canPayOnline: boolean;
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
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState<string>();

  const bandOf = (code: PlanCode) => f(p.band, { min: PLAN_BANDS[code].min, max: PLAN_BANDS[code].max });

  // The gateway path. The row is opened server side and the browser is sent
  // to PayUnit's page; it comes back to settings with the payment's id.
  const payNow = async () => {
    setOpening(true);
    setError(undefined);
    const result = await sb.startCheckout(locale, { agencyId, plan: choice, cycle });
    if (!result.ok) {
      setOpening(false);
      setError(result.error);
      return;
    }
    window.location.assign(result.url);
  };

  return (
    <Modal title={pc.modalTitle} subtitle={canPayOnline ? pc.modalSubtitleOnline : pc.modalSubtitle} onClose={onClose}>
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
                    <span className={`text-sm font-bold ${active ? "" : "text-azure-950 dark:text-white"}`}>{tierName(code, country, p.tiers[code].name)}</span>
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

        {canPayOnline && priceFor(country, choice, cycle) ? (
          <div className="space-y-3">
            <button
              type="button"
              onClick={payNow}
              disabled={opening || sending}
              className="w-full rounded-full bg-onyx py-3 text-sm font-semibold text-white transition hover:bg-azure-900 disabled:opacity-60 dark:bg-soft-500 dark:text-azure-950 dark:hover:bg-soft-400"
            >
              {opening ? pc.opening : `${pc.payNow} · ${formatMoney(priceFor(country, choice, cycle)!.amount, priceFor(country, choice, cycle)!.currency)}`}
            </button>
            <p className="text-center text-xs leading-relaxed text-onyx/50 dark:text-white/45">{pc.payNowHint}</p>
            <button
              type="button"
              onClick={onClose}
              className="w-full rounded-full py-2.5 text-sm font-semibold text-onyx/55 transition hover:text-azure-950 dark:text-white/55 dark:hover:text-white"
            >
              {t.dash.common.cancel}
            </button>
          </div>
        ) : (
          <ModalActions onCancel={onClose} submitLabel={sending ? t.dash.common.saving : pc.send} />
        )}
      </form>
    </Modal>
  );
}

export function SettingsForm({
  data,
  canPayOnline = false,
  returnedPayment = null,
}: {
  data: SettingsData;
  canPayOnline?: boolean;
  returnedPayment?: string | null;
}) {
  const { t, f, locale } = useI18n();
  const { notify, currentUser } = useStore();
  const [choosingPlan, setChoosingPlan] = useState(false);

  // Back from the gateway. Ask the server what became of the payment, say so
  // once, and take the id off the address so a reload does not ask again.
  useEffect(() => {
    if (!returnedPayment) return;
    let cancelled = false;
    (async () => {
      const result = await sb.confirmPayment(locale, returnedPayment);
      if (cancelled) return;
      const pc = t.dash.settings.planCard;
      if (!result.ok) notify(pc.paymentPending);
      else if (result.outcome === "paid") {
        const code = result.plan && isPlanCode(result.plan) ? result.plan : null;
        const day = result.until
          ? new Date(result.until).toLocaleDateString(locale === "fr" ? "fr-FR" : "en-GB", { day: "numeric", month: "long", year: "numeric" })
          : "";
        notify(f(pc.paid, { plan: code ? tierName(code, country, t.plans.tiers[code].name) : result.plan ?? "", date: day }));
      } else if (result.outcome === "pending") notify(pc.paymentPending);
      else notify(pc.paymentFailed);
      router.replace(window.location.pathname);
      router.refresh();
    })();
    return () => { cancelled = true; };
    // Runs once for the id the page was opened with.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [returnedPayment]);
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
          <PlanSummary canEdit={canEdit} canPayOnline={canPayOnline} onChoose={() => setChoosingPlan(true)} />
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

      {choosingPlan && (
        <PlanModal agencyId={agencyId} country={country} canPayOnline={canPayOnline} onClose={() => setChoosingPlan(false)} />
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
