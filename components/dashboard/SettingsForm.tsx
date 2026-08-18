"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { COUNTRIES } from "@/lib/countries";
import { useStore } from "@/lib/store";
import { useI18n } from "@/lib/i18n/context";
import { locales } from "@/lib/i18n";
import * as sb from "@/lib/supabase/actions";
import type { AgencyMember, MemberRole, ReminderRuleRow } from "@/lib/supabase/types";
import type { getSettingsData } from "@/lib/supabase/queries";
import { Card, CardTitle, PageTitle } from "@/components/dashboard/ui";
import { Field, Modal, ModalActions, fieldCls } from "@/components/dashboard/Modal";

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
  const { t, f } = useI18n();
  const { notify } = useStore();
  const router = useRouter();
  const m = t.dash.settings.inviteModal;
  const [error, setError] = useState<string>();
  const [sending, setSending] = useState(false);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const email = String(data.get("email") ?? "").trim();
    const role = String(data.get("role") ?? "manager") as MemberRole;
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
    const result = await sb.inviteMember("fr", { agencyId, email, role });
    setSending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    notify(f(m.invited, { email }));
    router.refresh();
    onClose();
  };

  return (
    <Modal title={m.title} subtitle={f(m.subtitle, { agency })} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <Field label={m.email} error={error}>
          <input name="email" type="email" placeholder="collegue@agence.com" className={fieldCls} />
        </Field>
        <Field label={m.role}>
          <select name="role" defaultValue="manager" className={fieldCls}>
            <option value="owner">{m.roles.owner}</option>
            <option value="manager">{m.roles.manager}</option>
            <option value="accountant">{m.roles.accountant}</option>
            <option value="caretaker">{m.roles.caretaker}</option>
          </select>
        </Field>
        <ModalActions onCancel={onClose} submitLabel={sending ? t.dash.common.saving : m.submit} />
      </form>
    </Modal>
  );
}

export function SettingsForm({ data }: { data: SettingsData }) {
  const { t, f, locale } = useI18n();
  const { notify } = useStore();
  const router = useRouter();
  const s = t.dash.settings;

  const live = data !== null;
  const agencyId = data?.agency.id ?? "";
  // The owner and manager roles are the only ones RLS lets update the agency
  // row, so a caretaker or accountant sees the same form read only.
  const canEdit = !live || data?.myRole === "owner" || data?.myRole === "manager";

  const [agencyName, setAgencyName] = useState(data?.agency.name ?? "Horizon Realty");
  const [whatsapp, setWhatsapp] = useState(data?.agency.whatsapp_number ?? "+224 620 00 00 00");
  const [country, setCountry] = useState(data?.agency.country ?? "Guinea");
  const [city, setCity] = useState(data?.agency.city ?? "Conakry");
  const [currency, setCurrency] = useState(data?.agency.currency ?? "GNF");

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
  const [channels, setChannels] = useState({ whatsapp: true, sms: false, email: true });

  const [members, setMembers] = useState<
    { userId?: string; name: string; role: string; email: string }[]
  >(
    data?.members.length
      ? data.members.map((m: AgencyMember) => ({
          userId: m.user_id,
          name: m.full_name ?? m.email.split("@")[0],
          role: s.inviteModal.roles[m.role],
          email: m.email,
        }))
      : [
          { name: "Amina Sow", role: s.inviteModal.roles.owner, email: "amina@horizonrealty.com" },
          { name: "Karim Diallo", role: s.inviteModal.roles.manager, email: "karim@horizonrealty.com" },
          { name: "Fatou Ba", role: s.inviteModal.roles.caretaker, email: "fatou@horizonrealty.com" },
        ]
  );

  const [inviting, setInviting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

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
            channel: "whatsapp" as const,
            isActive: reminders.before,
            escalationStep: 0,
          },
          ...(Object.keys(FIXED_OFFSETS) as (keyof typeof FIXED_OFFSETS)[]).map((key) => ({
            offsetDays: FIXED_OFFSETS[key],
            channel: "whatsapp" as const,
            isActive: reminders[key],
            escalationStep: key === "after" ? 1 : key === "escalation" ? 2 : 0,
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
        {/* agency */}
        <Card>
          <CardTitle>{s.agency}</CardTitle>
          <div className="space-y-4">
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
                  <option value="XOF">XOF</option>
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
            {(["whatsapp", "sms", "email"] as const).map((key) => {
              const on = channels[key];
              return (
                <button
                  key={key}
                  onClick={() => setChannels((c) => ({ ...c, [key]: !c[key] }))}
                  aria-pressed={on}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                    on
                      ? "bg-onyx text-white dark:bg-soft-500 dark:text-azure-950"
                      : "border border-azure-900/15 text-onyx/55 hover:bg-azure-900/5 dark:border-white/15 dark:text-white/55 dark:hover:bg-white/10"
                  }`}
                >
                  {key === "sms" ? "SMS" : t.dash.maintenance.via[key]}
                </button>
              );
            })}
          </div>
        </Card>

        {/* team */}
        <Card>
          <CardTitle>{s.team}</CardTitle>
          <div className="divide-y divide-azure-900/8 dark:divide-white/8">
            {members.map((m) => (
              <div key={m.email} className="flex items-center justify-between gap-4 py-3.5">
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
                {canEdit && (
                  <button
                    onClick={() => removeMember(m)}
                    className="shrink-0 rounded-full border border-azure-900/15 px-3.5 py-1.5 text-xs font-semibold text-onyx/55 transition hover:bg-azure-900/5 dark:border-white/15 dark:text-white/55 dark:hover:bg-white/10"
                  >
                    {s.remove}
                  </button>
                )}
              </div>
            ))}
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
          <div className="rounded-2xl border border-azure-900/10 bg-soft-50 p-5 dark:border-white/10 dark:bg-white/5">
            <p className="text-lg font-bold text-azure-950 dark:text-white">
              {t.dash.shell.growthPlan}
            </p>
            <p className="mt-1.5 text-sm text-onyx/70 dark:text-white/70">{s.trialNotice}</p>
            <div className="mt-4 flex flex-wrap gap-3">
              <button
                onClick={() => notify(s.changePlan)}
                className="rounded-full bg-onyx px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-azure-900 dark:bg-soft-500 dark:text-azure-950 dark:hover:bg-soft-400"
              >
                {s.changePlan}
              </button>
            </div>
          </div>
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
