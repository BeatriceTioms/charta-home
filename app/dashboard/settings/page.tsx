"use client";

import { useState } from "react";
import { Card, CardTitle, PageTitle } from "@/components/dashboard/ui";

function Field({
  label,
  defaultValue,
  type = "text",
}: {
  label: string;
  defaultValue: string;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-soft-500">{label}</span>
      <input
        type={type}
        defaultValue={defaultValue}
        className="w-full rounded-2xl border border-white/15 bg-white px-4 py-3 text-[15px] text-onyx outline-none transition focus:border-azure-600 focus:ring-4 focus:ring-azure-600/10"
      />
    </label>
  );
}

function Toggle({
  label,
  description,
  defaultOn = true,
}: {
  label: string;
  description: string;
  defaultOn?: boolean;
}) {
  const [on, setOn] = useState(defaultOn);
  return (
    <button
      type="button"
      onClick={() => setOn(!on)}
      className="flex w-full items-center justify-between gap-4 py-3.5 text-left"
    >
      <div>
        <p className="text-sm font-semibold text-white">{label}</p>
        <p className="text-xs text-white/45">{description}</p>
      </div>
      <span
        className={`relative h-7 w-12 shrink-0 rounded-full transition ${
          on ? "bg-soft-500" : "bg-white/15"
        }`}
      >
        <span
          className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${
            on ? "left-6" : "left-1"
          }`}
        />
      </span>
    </button>
  );
}

const TEAM = [
  { name: "Amina Sow", role: "Owner", email: "amina@horizonrealty.com" },
  { name: "Karim Diop", role: "Manager", email: "karim@horizonrealty.com" },
  { name: "Fatou Ba", role: "Caretaker, Les Palmiers", email: "fatou@horizonrealty.com" },
];

export default function SettingsPage() {
  return (
    <>
      <PageTitle
        title="Settings"
        subtitle="Your agency, your team, and how Charta Home speaks on your behalf."
      />

      <div className="grid gap-6 xl:grid-cols-2">
        {/* agency */}
        <Card>
          <CardTitle>Agency profile</CardTitle>
          <div className="space-y-4">
            <Field label="Agency name" defaultValue="Horizon Realty" />
            <Field label="Contact email" defaultValue="hello@horizonrealty.com" type="email" />
            <Field label="WhatsApp business number" defaultValue="+1 555 014 0000" />
            <p className="text-xs leading-relaxed text-white/45">
              This name and number appear on every reminder and owner report.
              Your tenants always hear from you, not from us.
            </p>
            <button className="rounded-full bg-azure-800 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-azure-900">
              Save changes
            </button>
          </div>
        </Card>

        {/* account */}
        <Card>
          <CardTitle>Your account</CardTitle>
          <div className="space-y-4">
            <Field label="Full name" defaultValue="Amina Sow" />
            <Field label="Email address" defaultValue="amina@horizonrealty.com" type="email" />
            <Field label="New password" defaultValue="" type="password" />
            <button className="rounded-full bg-azure-800 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-azure-900">
              Update account
            </button>
          </div>
        </Card>

        {/* notifications */}
        <Card>
          <CardTitle>Reminders & notifications</CardTitle>
          <div className="divide-y divide-white/8">
            <Toggle
              label="Rent reminders over WhatsApp"
              description="Courtesy reminder 5 days before rent is due"
            />
            <Toggle
              label="Late payment follow-ups"
              description="Measured escalation at 5, 10, and 15 days late"
            />
            <Toggle
              label="Maintenance updates to tenants"
              description="Status updates sent back over WhatsApp automatically"
            />
            <Toggle
              label="Weekly digest for you"
              description="A calm Monday summary of collections and open tickets"
              defaultOn={false}
            />
          </div>
        </Card>

        {/* plan */}
        <Card>
          <CardTitle>Plan & billing</CardTitle>
          <div className="rounded-2xl bg-azure-800 p-5 text-white">
            <div className="flex items-center justify-between">
              <p className="font-bold text-soft-500">Growth</p>
              <p className="text-sm text-white/60">$79 / month</p>
            </div>
            <p className="mt-1.5 text-sm text-white/70">
              Free trial, 21 days remaining. You will not be charged before
              choosing to continue.
            </p>
          </div>
          <div className="mt-4 flex gap-3">
            <button className="flex-1 rounded-full bg-soft-500 py-2.5 text-sm font-bold text-azure-950 transition hover:bg-soft-400">
              Choose plan
            </button>
            <button className="flex-1 rounded-full border border-white/15 py-2.5 text-sm font-semibold text-soft-500 transition hover:bg-white/10">
              Compare plans
            </button>
          </div>
          <p className="mt-4 text-xs leading-relaxed text-white/45">
            Cancel anytime. Your data remains exportable for 90 days after your
            subscription ends. It is yours, always.
          </p>
        </Card>

        {/* team */}
        <Card className="xl:col-span-2">
          <CardTitle>Team</CardTitle>
          <div className="divide-y divide-white/8">
            {TEAM.map((m) => (
              <div key={m.email} className="flex items-center justify-between gap-4 py-3.5">
                <div className="flex items-center gap-3.5">
                  <span className="grid h-10 w-10 place-items-center rounded-full bg-azure-800 text-xs font-bold text-soft-500">
                    {m.name.split(" ").map((w) => w[0]).join("")}
                  </span>
                  <div>
                    <p className="text-sm font-bold text-white">{m.name}</p>
                    <p className="text-xs text-white/45">{m.email}</p>
                  </div>
                </div>
                <span className="rounded-full bg-soft-200 px-3 py-1 text-xs font-semibold text-azure-950">
                  {m.role}
                </span>
              </div>
            ))}
          </div>
          <button className="mt-4 rounded-full border border-white/15 px-6 py-2.5 text-sm font-semibold text-soft-500 transition hover:bg-white/10">
            Invite a team member
          </button>
        </Card>
      </div>
    </>
  );
}
