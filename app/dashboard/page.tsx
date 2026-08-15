"use client";

import Image from "next/image";
import Link from "next/link";
import { activity, fmt, tickets } from "@/lib/data";
import { useBuilding } from "@/lib/building-context";
import { Card, CardTitle } from "@/components/dashboard/ui";

/* ---------- work orders donut ---------- */

function WorkOrdersDonut({
  segments,
  total,
}: {
  segments: { value: number; color: string }[];
  total: number;
}) {
  const C = 2 * Math.PI * 42;
  let offset = 0;
  return (
    <div className="relative h-36 w-36 shrink-0">
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
        <circle cx="50" cy="50" r="42" fill="none" stroke="var(--donut-track)" strokeWidth="11" />
        {segments.map((s, i) => {
          const len = total === 0 ? 0 : (s.value / total) * C;
          const el = (
            <circle
              key={i}
              cx="50" cy="50" r="42" fill="none"
              stroke={s.color} strokeWidth="11" strokeLinecap="round"
              strokeDasharray={`${len} ${C}`}
              strokeDashoffset={-offset}
            />
          );
          offset += len;
          return el;
        })}
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <p className="text-2xl font-extrabold text-azure-950 dark:text-white">{total}</p>
          <p className="text-[11px] text-onyx/45 dark:text-white/45">total</p>
        </div>
      </div>
    </div>
  );
}

/* ---------- recent activity ---------- */

const ACTIVITY_ICONS = {
  payment: (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6L9 17l-5-5" />
    </svg>
  ),
  ticket: (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.7 6.3a4.5 4.5 0 00-6 6L3 18l3 3 5.7-5.7a4.5 4.5 0 006-6L15 12l-3-3 2.7-2.7z" />
    </svg>
  ),
  lease: (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8zM14 2v6h6M9 13h6M9 17h4" />
    </svg>
  ),
};

const UNIT_PHOTOS = [
  "/photos/interior-2.jpg",
  "/photos/interior-3.jpg",
  "/photos/interior-4.jpg",
];

/* ---------- rent follow up ---------- */

const STEPS = ["Reminder sent", "Second reminder", "Escalation", "Paid"];

function FollowUpRow({
  name,
  unit,
  aptId,
  amount,
  step,
  photo,
}: {
  name: string;
  unit: string;
  aptId: string;
  amount: number;
  step: number;
  photo: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-5 rounded-2xl border border-azure-900/8 p-4 dark:border-white/8">
      <Link href={`/dashboard/apartments/${aptId}`} className="flex min-w-56 items-center gap-3.5">
        <Image
          src={photo}
          alt={unit}
          width={160}
          height={112}
          className="h-14 w-20 shrink-0 rounded-xl object-cover"
        />
        <div>
          <p className="text-sm font-bold text-azure-950 transition hover:text-azure-600 dark:text-white dark:hover:text-soft-500">
            {unit} · {name}
          </p>
          <p className="text-xs text-onyx/45 dark:text-white/45">{fmt(amount)} due</p>
        </div>
      </Link>
      <div className="flex min-w-0 flex-1 items-center pt-1">
        {STEPS.map((label, i) => (
          <div key={label} className={`flex items-center ${i === 0 ? "" : "flex-1"}`}>
            {i > 0 && (
              <span
                className={`mx-2 h-[3px] flex-1 rounded-full ${
                  i <= step
                    ? "bg-gradient-to-r from-azure-600 to-soft-500"
                    : "bg-azure-900/10 dark:bg-white/10"
                }`}
              />
            )}
            <div className="relative flex flex-col items-center gap-1.5">
              {i < step ? (
                <span className="grid h-5 w-5 place-items-center rounded-full bg-soft-500">
                  <svg viewBox="0 0 24 24" className="h-3 w-3 text-azure-950" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                </span>
              ) : i === step ? (
                <span className="grid h-5 w-5 place-items-center rounded-full border-2 border-soft-500">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-soft-500" />
                </span>
              ) : (
                <span className="h-5 w-5 rounded-full border-2 border-azure-900/15 dark:border-white/20" />
              )}
              <span
                className={`whitespace-nowrap text-[10px] font-semibold ${
                  i <= step ? "text-azure-600 dark:text-soft-500" : "text-onyx/35 dark:text-white/35"
                }`}
              >
                {label}
              </span>
            </div>
          </div>
        ))}
      </div>
      <button
        aria-label={`Call ${name}`}
        className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-onyx text-white transition hover:bg-azure-900 dark:bg-white dark:text-onyx dark:hover:bg-soft-400"
      >
        <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 16.9v3a2 2 0 01-2.2 2 19.8 19.8 0 01-8.6-3.1 19.5 19.5 0 01-6-6A19.8 19.8 0 012.1 4.2 2 2 0 014.1 2h3a2 2 0 012 1.7c.1 1 .4 2 .7 2.9a2 2 0 01-.5 2.1L8 10a16 16 0 006 6l1.3-1.3a2 2 0 012.1-.5c.9.3 1.9.6 2.9.7a2 2 0 011.7 2z" />
        </svg>
      </button>
    </div>
  );
}

/* ---------- page ---------- */

export default function DashboardPage() {
  const { building } = useBuilding();

  const occupied = building.apartments.filter((a) => a.tenant);
  const vacant = building.apartments.length - occupied.length;
  const rentCollected = occupied
    .filter((a) => a.rentStatus === "paid")
    .reduce((s, a) => s + a.rent, 0);
  const debt = occupied
    .filter((a) => a.rentStatus === "overdue")
    .reduce((s, a) => s + a.rent, 0);
  const services = Math.round(rentCollected * 0.08);
  const maintenanceCost = Math.round(building.expensesYtd / 8);

  const bTickets = tickets.filter((t) => t.buildingId === building.id);
  const counts = {
    new: bTickets.filter((t) => t.status === "new").length,
    assigned: bTickets.filter((t) => t.status === "assigned").length,
    progress: bTickets.filter((t) => t.status === "in-progress").length,
    resolved: bTickets.filter((t) => t.status === "resolved").length,
  };
  const schedule = activity.filter((a) => a.buildingId === building.id);
  const viewings = schedule.filter((a) => a.kind === "viewing").length;

  const chasing = occupied
    .filter((a) => a.rentStatus !== "paid")
    .map((a, i) => ({
      name: a.tenant!.name,
      unit: a.label,
      aptId: a.id,
      amount: a.rent,
      step: a.rentStatus === "overdue" ? 2 : 1,
      photo: UNIT_PHOTOS[i % UNIT_PHOTOS.length],
    }));

  const recent = [
    occupied.find((a) => a.rentStatus === "paid") && {
      title: "Rent payment received",
      detail: `${occupied.find((a) => a.rentStatus === "paid")!.label} · ${occupied.find((a) => a.rentStatus === "paid")!.tenant!.name}`,
      time: "2 hours ago",
      photo: UNIT_PHOTOS[0],
      icon: ACTIVITY_ICONS.payment,
    },
    bTickets.find((t) => t.status === "resolved") && {
      title: "Ticket resolved",
      detail: bTickets.find((t) => t.status === "resolved")!.title,
      time: "Yesterday",
      photo: UNIT_PHOTOS[1],
      icon: ACTIVITY_ICONS.ticket,
    },
    occupied[occupied.length - 1] && {
      title: "Lease renewed",
      detail: `${occupied[occupied.length - 1].label} · ${occupied[occupied.length - 1].tenant!.name}`,
      time: "2 days ago",
      photo: UNIT_PHOTOS[2],
      icon: ACTIVITY_ICONS.lease,
    },
  ].filter(Boolean) as {
    title: string;
    detail: string;
    time: string;
    photo: string;
    icon: React.ReactNode;
  }[];

  return (
    <>
      <h1 className="font-serif text-3xl font-medium tracking-tight sm:text-4xl">
        <span className="text-onyx/50 dark:text-white/50">Good morning,</span>{" "}
        <span className="text-azure-950 dark:text-white">Amina</span>
      </h1>
      <p className="mt-1.5 text-[15px] text-onyx/40 dark:text-white/40">
        Here is how {building.name} stands today, 8 August 2026.
      </p>

      <div className="mt-8 grid gap-6 xl:grid-cols-[1.65fr_1fr]">
        {/* ---------- left column ---------- */}
        <div className="space-y-6">
          {/* building hero */}
          <div className="relative overflow-hidden rounded-[2rem]">
            <Image
              src={building.photo}
              alt={building.name}
              width={1600}
              height={1067}
              className="h-[360px] w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-onyx/85 via-onyx/45 to-onyx/10" />
            <div className="absolute inset-0 flex flex-col justify-between p-8">
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full bg-soft-500 px-4 py-1.5 text-xs font-bold text-azure-950">
                  {building.netYield}% net yield
                </span>
                <span className="rounded-full border border-white/25 bg-onyx/40 px-4 py-1.5 text-xs font-semibold text-white backdrop-blur-sm">
                  {occupied.length}/{building.apartments.length} occupied
                </span>
                {vacant > 0 && (
                  <span className="rounded-full border border-white/25 bg-onyx/40 px-4 py-1.5 text-xs font-semibold text-white backdrop-blur-sm">
                    {vacant} to let
                  </span>
                )}
              </div>
              <div>
                <h2 className="font-serif text-4xl font-medium tracking-tight text-white">
                  {building.name}
                </h2>
                <p className="mt-1.5 flex items-center gap-1.5 text-sm text-white/70">
                  <svg viewBox="0 0 24 24" className="h-4 w-4 text-soft-500" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 1118 0z" /><circle cx="12" cy="10" r="3" />
                  </svg>
                  {building.address} · {building.city}
                </p>
                <p className="mt-3 max-w-md text-sm leading-relaxed text-white/75">
                  {fmt(building.incomeYtd)} of income so far this year, against{" "}
                  {fmt(building.expensesYtd)} of expenses.
                </p>
                <Link
                  href="/dashboard/apartments"
                  className="mt-5 inline-block rounded-full bg-soft-500 px-6 py-2.5 text-sm font-bold text-azure-950 transition hover:bg-soft-400"
                >
                  View apartments
                </Link>
              </div>
            </div>
          </div>

          {/* payments */}
          <Card>
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-[15px] font-bold text-azure-950 dark:text-white">Payments</h2>
              <span className="rounded-full border border-white/70 bg-white/50 px-3.5 py-1.5 text-xs font-semibold text-azure-800 backdrop-blur-xl dark:border-white/10 dark:bg-white/5 dark:text-soft-500">
                This month
              </span>
            </div>
            <div className="grid grid-cols-2 gap-6 lg:grid-cols-4">
              <div>
                <p className="text-2xl font-extrabold tracking-tight text-azure-950 dark:text-white">{fmt(rentCollected)}</p>
                <p className="mt-0.5 text-xs text-onyx/45 dark:text-white/45">Rent collected</p>
              </div>
              <div>
                <p className="text-2xl font-extrabold tracking-tight text-azure-950 dark:text-white">{fmt(services)}</p>
                <p className="mt-0.5 text-xs text-onyx/45 dark:text-white/45">Charges and services</p>
              </div>
              <div>
                <p className="text-2xl font-extrabold tracking-tight text-azure-950 dark:text-white">{fmt(maintenanceCost)}</p>
                <p className="mt-0.5 text-xs text-onyx/45 dark:text-white/45">Maintenance</p>
              </div>
              <div>
                <p className="flex items-center gap-1.5 text-2xl font-extrabold tracking-tight text-azure-950 dark:text-white">
                  <span className="grid h-5 w-5 place-items-center rounded-full bg-onyx text-[11px] font-bold text-white dark:bg-white dark:text-onyx">!</span>
                  {fmt(debt)}
                </p>
                <p className="mt-0.5 text-xs text-onyx/45 dark:text-white/45">Outstanding debt</p>
              </div>
            </div>
          </Card>

          {/* recent activity */}
          <Card>
            <CardTitle action={{ label: "See more", href: "/dashboard/rent" }}>
              Recent activity
            </CardTitle>
            <div className="grid gap-4 sm:grid-cols-3">
              {recent.map((a) => (
                <div key={a.title} className="overflow-hidden rounded-2xl border border-azure-900/8 dark:border-white/8">
                  <div className="relative h-32">
                    <Image src={a.photo} alt="" fill className="object-cover" />
                    <span className="absolute left-3 top-3 grid h-8 w-8 place-items-center rounded-full bg-onyx/70 text-soft-500 backdrop-blur-sm">
                      {a.icon}
                    </span>
                  </div>
                  <div className="p-4">
                    <p className="text-sm font-bold text-azure-950 dark:text-white">{a.title}</p>
                    <p className="mt-0.5 truncate text-xs text-onyx/50 dark:text-white/50">{a.detail}</p>
                    <p className="mt-1.5 text-[11px] text-onyx/35 dark:text-white/35">{a.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* rent follow up */}
          <Card>
            <CardTitle action={{ label: "See more", href: "/dashboard/rent" }}>
              Rent follow up
            </CardTitle>
            {chasing.length === 0 ? (
              <p className="py-6 text-center text-sm text-onyx/45 dark:text-white/45">
                Every lease in this building is paid up. Nothing to chase.
              </p>
            ) : (
              <div className="space-y-4">
                {chasing.map((c) => (
                  <FollowUpRow key={c.aptId} {...c} />
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* ---------- right column ---------- */}
        <div className="space-y-6">
          {/* building summary */}
          <Card>
            <CardTitle action={{ label: "Apartments", href: "/dashboard/apartments" }}>
              Building at a glance
            </CardTitle>
            <div className="grid grid-cols-4 gap-2 text-center">
              {[
                [String(occupied.length), "Residents"],
                [String(building.apartments.length), "Units"],
                [String(vacant), "Vacant"],
                [String(viewings), "Viewings"],
              ].map(([v, l]) => (
                <div key={l}>
                  <p className="text-xl font-extrabold text-azure-950 dark:text-white">{v}</p>
                  <p className="text-[11px] text-onyx/45 dark:text-white/40">{l}</p>
                </div>
              ))}
            </div>
            <div className="mt-5 space-y-2">
              {building.apartments.slice(0, 4).map((a) => (
                <Link
                  key={a.id}
                  href={`/dashboard/apartments/${a.id}`}
                  className="-mx-2 flex items-center justify-between gap-3 rounded-xl px-2 py-2 transition hover:bg-azure-900/5 dark:hover:bg-white/5"
                >
                  <span className="min-w-0">
                    <span className="block text-sm font-bold text-azure-950 dark:text-white">{a.label}</span>
                    <span className="block truncate text-xs text-onyx/45 dark:text-white/40">
                      {a.tenant ? a.tenant.name : "Vacant"}
                    </span>
                  </span>
                  <span className="shrink-0 text-sm font-semibold text-azure-600 dark:text-soft-500">
                    {fmt(a.rent)}
                  </span>
                </Link>
              ))}
            </div>
          </Card>

          {/* work orders */}
          <Card>
            <CardTitle action={{ label: "Open", href: "/dashboard/maintenance" }}>
              Work orders
            </CardTitle>
            <div className="flex items-center gap-6">
              <WorkOrdersDonut
                total={bTickets.length}
                segments={[
                  { value: counts.new, color: "var(--donut-strong)" },
                  { value: counts.assigned, color: "#addfe1" },
                  { value: counts.progress, color: "#14639b" },
                  { value: counts.resolved, color: "var(--donut-muted)" },
                ]}
              />
              <div className="grid flex-1 grid-cols-2 gap-x-4 gap-y-3 text-sm">
                {[
                  [counts.new, "New", "bg-onyx dark:bg-white"],
                  [counts.assigned, "Assigned", "bg-soft-500"],
                  [counts.progress, "In progress", "bg-azure-600"],
                  [counts.resolved, "Resolved", "bg-onyx/30 dark:bg-white/30"],
                ].map(([v, l, dot]) => (
                  <div key={l as string}>
                    <p className="flex items-center gap-2 text-lg font-extrabold text-azure-950 dark:text-white">
                      <span className={`h-2.5 w-2.5 rounded-full ${dot}`} />
                      {v}
                    </p>
                    <p className="text-[11px] text-onyx/45 dark:text-white/40">{l}</p>
                  </div>
                ))}
              </div>
            </div>
          </Card>

          {/* today's schedule */}
          <Card>
            <CardTitle>Today at {building.name.split(" ").slice(-1)[0]}</CardTitle>
            {schedule.length === 0 ? (
              <p className="text-sm text-onyx/45 dark:text-white/45">Nothing scheduled today.</p>
            ) : (
              <div className="space-y-3">
                {schedule.map((item) => (
                  <div key={`${item.time}-${item.title}`} className="flex gap-3">
                    <p className="w-12 shrink-0 pt-3 text-right text-sm font-bold text-azure-950 dark:text-white">
                      {item.time}
                    </p>
                    <div
                      className={`flex-1 rounded-2xl p-3.5 ${
                        item.kind === "viewing"
                          ? "bg-soft-200 text-azure-950 dark:bg-white/10 dark:text-white"
                          : "bg-onyx text-white dark:bg-white/[0.06]"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-bold">{item.title}</p>
                          <p className={`mt-0.5 truncate text-xs ${item.kind === "viewing" ? "opacity-60" : "text-white/65"}`}>
                            {item.detail}
                          </p>
                        </div>
                        <span
                          className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-[10px] font-bold ${
                            item.kind === "viewing"
                              ? "bg-white text-azure-800"
                              : "bg-white/15 text-soft-500"
                          }`}
                        >
                          {item.who}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
