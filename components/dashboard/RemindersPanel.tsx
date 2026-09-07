"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatMoney } from "@/lib/data";
import { useI18n } from "@/lib/i18n/context";
import { useStore } from "@/lib/store";
import * as sb from "@/lib/supabase/actions";
import { renderMessage } from "@/lib/whatsapp";
import { Field, Modal, fieldCls } from "@/components/dashboard/Modal";

/**
 * When tenants are chased, and what they are told.
 *
 * This sat on the settings page, two clicks away from the arrears it is
 * about. It is a tab on rent collection now, beside the leases it acts on.
 *
 * Each toggle is one row in reminder_rules. The courtesy reminder's lead
 * time is chosen by the agency, so its offset is negative but not fixed;
 * the other three sit at offsets the product defines.
 */
const FIXED_OFFSETS = { onDue: 0, after: 5, escalation: 10 } as const;
type ReminderKey = "before" | keyof typeof FIXED_OFFSETS;

/** Lead times an agency can pick for the reminder before rent falls due. */
const LEAD_DAYS = [1, 2, 3, 5, 7, 10, 14];
const DEFAULT_LEAD = 3;

const PLACEHOLDERS = ["tenant", "amount", "period", "days", "agency", "apartment"];

export function RemindersPanel() {
  const { t, f, locale } = useI18n();
  const { reminderRules, agencyId, agencyInfo, currentUser, notify } = useStore();
  const router = useRouter();
  const s = t.dash.settings;
  const r = t.dash.rent.reminders;

  // The cadence is the agency's, and so is the wording sent in its name.
  const canEdit = !currentUser || currentUser.role === "owner" || currentUser.role === "manager";

  const beforeRule = reminderRules.find((x) => x.offset_days < 0);
  const fixedOn = (key: keyof typeof FIXED_OFFSETS) =>
    reminderRules.some((x) => x.offset_days === FIXED_OFFSETS[key] && x.is_active);

  const [reminders, setReminders] = useState({
    before: beforeRule?.is_active ?? true,
    onDue: reminderRules.length === 0 ? true : fixedOn("onDue"),
    after: reminderRules.length === 0 ? true : fixedOn("after"),
    escalation: reminderRules.length === 0 ? true : fixedOn("escalation"),
  });
  const [leadDays, setLeadDays] = useState(
    beforeRule ? Math.abs(beforeRule.offset_days) : DEFAULT_LEAD
  );

  const bodyOf = (key: ReminderKey) => {
    const rule =
      key === "before" ? beforeRule : reminderRules.find((x) => x.offset_days === FIXED_OFFSETS[key]);
    return rule?.message_body ?? s.messageDefaults[key];
  };
  const [messages, setMessages] = useState<Record<ReminderKey, string>>({
    before: bodyOf("before"),
    onDue: bodyOf("onDue"),
    after: bodyOf("after"),
    escalation: bodyOf("escalation"),
  });
  const [editing, setEditing] = useState<ReminderKey | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const save = async () => {
    if (!agencyId) {
      notify(r.saved);
      return;
    }
    setSaving(true);
    const result = await sb.upsertReminderRules(locale, {
      agencyId,
      rules: [
        {
          offsetDays: -leadDays,
          // Email, always. It is the only channel that sends by itself; a
          // WhatsApp reminder is a person pressing the button on a lease.
          channel: "email",
          isActive: reminders.before,
          escalationStep: 0,
          messageBody: messages.before,
        },
        ...(Object.keys(FIXED_OFFSETS) as (keyof typeof FIXED_OFFSETS)[]).map((key) => ({
          offsetDays: FIXED_OFFSETS[key],
          channel: "email" as const,
          isActive: reminders[key],
          escalationStep: key === "after" ? 1 : key === "escalation" ? 2 : 0,
          messageBody: messages[key],
        })),
      ],
    });
    setSaving(false);
    if (!result.ok) {
      notify(t.dash.common.saveFailed);
      return;
    }
    setSaved(true);
    notify(r.saved);
    setTimeout(() => setSaved(false), 2500);
    router.refresh();
  };

  const rows: [ReminderKey, string][] = [
    ["before", s.beforeDue],
    ["onDue", s.onDue],
    ["after", s.afterDue],
    ["escalation", s.escalation],
  ];

  return (
    <div className="rounded-3xl border border-white/70 bg-white/55 p-6 shadow-lg shadow-azure-900/5 backdrop-blur-2xl dark:border-white/10 dark:bg-white/[0.05] dark:shadow-none">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-lg font-bold text-azure-950 dark:text-white">{s.reminders}</p>
          <p className="mt-1 max-w-2xl text-sm text-onyx/50 dark:text-white/45">{r.note}</p>
        </div>
        {canEdit && (
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="rounded-full bg-onyx px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-azure-900 disabled:opacity-60 dark:bg-soft-500 dark:text-azure-950 dark:hover:bg-soft-400"
          >
            {saving ? t.dash.common.saving : saved ? t.dash.common.saved : s.saveChanges}
          </button>
        )}
      </div>

      {/* What actually carries a reminder. Stated rather than chosen: there
          is one automatic channel, and pretending otherwise was the bug. */}
      <div className="mt-5 flex flex-wrap items-center gap-3 rounded-2xl border border-azure-900/10 bg-azure-900/[0.03] px-4 py-3 dark:border-white/10 dark:bg-white/5">
        <span className="inline-flex items-center gap-2 rounded-full bg-onyx px-3 py-1 text-xs font-bold text-white dark:bg-soft-500 dark:text-azure-950">
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="4" width="20" height="16" rx="3" /><path d="M22 7l-10 6L2 7" />
          </svg>
          {t.dash.maintenance.via.email}
        </span>
        <p className="min-w-0 flex-1 text-xs leading-relaxed text-onyx/55 dark:text-white/50">
          {r.channelNote}
        </p>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        {rows.map(([key, label]) => (
          <div key={key} className="rounded-2xl border border-azure-900/10 p-4 dark:border-white/10">
            <div className="flex items-center justify-between gap-4">
              <span className="text-sm font-semibold text-azure-950 dark:text-white">{label}</span>
              <Toggle
                label={label}
                on={reminders[key]}
                disabled={!canEdit}
                onChange={(v) => setReminders((x) => ({ ...x, [key]: v }))}
              />
            </div>

            {/* The message itself, which the agency writes. Shown only when
                the reminder is on, since it sends nothing otherwise. */}
            {reminders[key] && (
              <button
                type="button"
                onClick={() => setEditing(key)}
                className="mt-3 flex w-full items-start gap-2.5 rounded-xl border border-azure-900/10 bg-azure-900/[0.03] px-3 py-2 text-left transition hover:bg-azure-900/[0.06] dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
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

            {/* How far ahead the courtesy reminder goes out. Only shown when
                it is switched on, since it means nothing otherwise. */}
            {key === "before" && reminders.before && (
              <label className="mt-2.5 flex items-center justify-between gap-3 rounded-xl border border-azure-900/10 bg-azure-900/[0.03] px-3 py-2 dark:border-white/10 dark:bg-white/5">
                <span className="text-xs text-onyx/55 dark:text-white/55">{s.leadTime}</span>
                <select
                  value={leadDays}
                  disabled={!canEdit}
                  onChange={(e) => setLeadDays(Number(e.target.value))}
                  aria-label={s.leadTime}
                  className="rounded-lg border border-azure-900/15 bg-white px-2.5 py-1 text-sm font-semibold text-azure-950 outline-none dark:border-white/15 dark:bg-white/10 dark:text-white dark:[&>option]:bg-onyx"
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

      {editing && (
        <MessageModal
          label={rows.find(([k]) => k === editing)![1]}
          value={messages[editing]}
          canEdit={canEdit}
          agencyName={agencyInfo?.name ?? ""}
          currency={agencyInfo?.currency ?? "GNF"}
          leadDays={leadDays}
          onSave={(next) => {
            setMessages((m) => ({ ...m, [editing]: next }));
            setEditing(null);
          }}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function Toggle({
  on,
  onChange,
  label,
  disabled,
}: {
  on: boolean;
  onChange: (v: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition disabled:opacity-50 ${
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

/** The agency's own wording, with a preview of what a tenant will read. */
function MessageModal({
  label,
  value,
  canEdit,
  agencyName,
  currency,
  leadDays,
  onSave,
  onClose,
}: {
  label: string;
  value: string;
  canEdit: boolean;
  agencyName: string;
  currency: string;
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
    amount: formatMoney(1200000, currency),
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
