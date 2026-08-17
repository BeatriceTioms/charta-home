"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { COUNTRIES } from "@/lib/countries";
import { useBuilding } from "@/lib/building-context";
import { useStore } from "@/lib/store";
import { useI18n } from "@/lib/i18n/context";
import { locales } from "@/lib/i18n";
import { Card, CardTitle, PageTitle } from "@/components/dashboard/ui";
import { Field, Modal, ModalActions, fieldCls } from "@/components/dashboard/Modal";

type Member = { name: string; role: string; email: string };

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

function InviteModal({ onClose, agency }: { onClose: () => void; agency: string }) {
  const { t, f } = useI18n();
  const { notify } = useStore();
  const m = t.dash.settings.inviteModal;
  const [error, setError] = useState<string>();

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const email = String(new FormData(e.currentTarget).get("email") ?? "").trim();
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setError(t.contactPage.form.errorEmail);
      return;
    }
    notify(f(m.invited, { email }));
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
        <ModalActions onCancel={onClose} submitLabel={m.submit} />
      </form>
    </Modal>
  );
}

export default function SettingsPage() {
  const { t, locale } = useI18n();
  const { buildings } = useBuilding();
  const { notify } = useStore();
  const router = useRouter();
  const s = t.dash.settings;

  const [agencyName, setAgencyName] = useState("Horizon Realty");
  const [whatsapp, setWhatsapp] = useState("+224 620 00 00 00");
  const [country, setCountry] = useState("Guinea");
  const [city, setCity] = useState("Conakry");
  const [currency, setCurrency] = useState("GNF");

  const [reminders, setReminders] = useState({
    before: true,
    onDue: true,
    after: true,
    escalation: false,
  });
  const [channels, setChannels] = useState({ whatsapp: true, sms: false, email: true });

  const [members, setMembers] = useState<Member[]>([
    { name: "Amina Sow", role: s.inviteModal.roles.owner, email: "amina@horizonrealty.com" },
    { name: "Karim Diallo", role: s.inviteModal.roles.manager, email: "karim@horizonrealty.com" },
    { name: "Fatou Ba", role: s.inviteModal.roles.caretaker, email: "fatou@horizonrealty.com" },
  ]);

  const [inviting, setInviting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const save = () => {
    setSaving(true);
    setTimeout(() => {
      setSaving(false);
      setSaved(true);
      notify(s.saveChanges);
      setTimeout(() => setSaved(false), 2500);
    }, 500);
  };

  const exportData = () => {
    const payload = {
      exportedAt: "2026-08-08",
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
    notify(s.exportData);
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
          <button
            onClick={save}
            disabled={saving}
            className="rounded-full bg-onyx px-6 py-3 text-sm font-semibold text-white transition hover:bg-azure-900 disabled:opacity-60 dark:bg-soft-500 dark:text-azure-950 dark:hover:bg-soft-400"
          >
            {saving ? t.dash.common.saving : saved ? t.dash.common.saved : s.saveChanges}
          </button>
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
                onChange={(e) => setAgencyName(e.target.value)}
                className={fieldCls}
              />
            </Field>
            <Field label={s.whatsappNumber}>
              <input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} className={fieldCls} />
            </Field>
            <p className="text-xs leading-relaxed text-onyx/50 dark:text-white/45">{s.agencyNote}</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={s.country}>
                <select value={country} onChange={(e) => setCountry(e.target.value)} className={fieldCls}>
                  {COUNTRIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </Field>
              <Field label={s.city}>
                <input value={city} onChange={(e) => setCity(e.target.value)} className={fieldCls} />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={s.currency}>
                <select value={currency} onChange={(e) => setCurrency(e.target.value)} className={fieldCls}>
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
            {[
              ["before", s.beforeDue] as const,
              ["onDue", s.onDue] as const,
              ["after", s.afterDue] as const,
              ["escalation", s.escalation] as const,
            ].map(([key, label]) => (
              <div key={key} className="flex items-center justify-between gap-4">
                <span className="text-sm text-onyx/75 dark:text-white/75">{label}</span>
                <Toggle
                  label={label}
                  on={reminders[key]}
                  onChange={(v) => setReminders((r) => ({ ...r, [key]: v }))}
                />
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
                  {t.dash.maintenance.via[key === "sms" ? "phone" : key] === "Téléphone" && key === "sms"
                    ? "SMS"
                    : key === "sms"
                      ? "SMS"
                      : t.dash.maintenance.via[key]}
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
                <button
                  onClick={() => setMembers((list) => list.filter((x) => x.email !== m.email))}
                  className="shrink-0 rounded-full border border-azure-900/15 px-3.5 py-1.5 text-xs font-semibold text-onyx/55 transition hover:bg-azure-900/5 dark:border-white/15 dark:text-white/55 dark:hover:bg-white/10"
                >
                  {s.remove}
                </button>
              </div>
            ))}
          </div>
          <button
            onClick={() => setInviting(true)}
            className="mt-5 w-full rounded-full border border-azure-900/15 py-2.5 text-sm font-semibold text-azure-800 transition hover:bg-azure-900/5 dark:border-white/15 dark:text-soft-500 dark:hover:bg-white/10"
          >
            {s.invite}
          </button>
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
          <button
            onClick={exportData}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-full border border-azure-900/15 py-2.5 text-sm font-semibold text-azure-800 transition hover:bg-azure-900/5 dark:border-white/15 dark:text-soft-500 dark:hover:bg-white/10"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3v12M8 11l4 4 4-4M4 21h16" />
            </svg>
            {s.exportData}
          </button>
        </Card>
      </div>

      {inviting && <InviteModal agency={agencyName} onClose={() => setInviting(false)} />}
    </>
  );
}
