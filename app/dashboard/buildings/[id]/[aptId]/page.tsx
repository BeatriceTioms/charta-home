import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { activity, buildings, fmt, getBuilding, tickets } from "@/lib/data";
import {
  Card,
  CardTitle,
  RentChip,
  StatCard,
  TicketChip,
} from "@/components/dashboard/ui";

export function generateStaticParams() {
  return buildings.flatMap((b) =>
    b.apartments.map((a) => ({ id: b.id, aptId: a.id }))
  );
}

const WEEK = [
  { day: 5, label: "Wed" },
  { day: 6, label: "Thu" },
  { day: 7, label: "Fri" },
  { day: 8, label: "Sat", active: true },
  { day: 9, label: "Sun" },
  { day: 10, label: "Mon" },
  { day: 11, label: "Tue" },
];

export default async function ApartmentPage({
  params,
}: {
  params: Promise<{ id: string; aptId: string }>;
}) {
  const { id, aptId } = await params;
  const building = getBuilding(id);
  const apartment = building?.apartments.find((a) => a.id === aptId);
  if (!building || !apartment) notFound();

  const aptTickets = tickets.filter(
    (t) => t.buildingId === building.id && t.apartment === apartment.label
  );
  const schedule = activity.filter((a) => a.buildingId === building.id);
  const team = [...new Set(schedule.map((s) => s.who))];

  return (
    <>
      {/* header */}
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link
            href={`/dashboard/buildings/${building.id}`}
            aria-label={`Back to ${building.name}`}
            className="grid h-11 w-11 place-items-center rounded-full border border-white/10 text-white transition hover:bg-white/10"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M11 18l-6-6 6-6" />
            </svg>
          </Link>
          <Image
            src={building.interior}
            alt={apartment.label}
            width={112}
            height={112}
            className="h-14 w-14 rounded-2xl object-cover"
          />
          <div>
            <h1 className="font-serif text-3xl font-medium tracking-tight text-white sm:text-4xl">
              {apartment.label}
            </h1>
            <p className="mt-0.5 flex items-center gap-1.5 text-sm text-white/50">
              <svg viewBox="0 0 24 24" className="h-4 w-4 text-soft-500" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 1118 0z" /><circle cx="12" cy="10" r="3" />
              </svg>
              {building.name} · {apartment.cycle} lease
            </p>
          </div>
        </div>
        <button className="rounded-full bg-soft-500 px-6 py-3 text-sm font-semibold text-azure-950 transition hover:bg-soft-400">
          {apartment.tenant ? "Send payment reminder" : "Add lease"}
        </button>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.9fr_1fr]">
        {/* ---------- main column ---------- */}
        <div className="space-y-6">
          {/* interior showcase with room pills and stat chips */}
          <div className="relative overflow-hidden rounded-3xl shadow-sm shadow-azure-800/5">
            <Image
              src={building.interior}
              alt={`Inside ${apartment.label}`}
              width={1600}
              height={1067}
              className="aspect-[16/9] w-full object-cover"
            />
            <div className="absolute left-1/2 top-4 flex -translate-x-1/2 items-center gap-1 rounded-full bg-white/85 p-1.5 backdrop-blur-md">
              <span className="rounded-full bg-azure-800 px-4 py-1.5 text-xs font-bold text-white">
                Living room
              </span>
              <span className="px-3 py-1.5 text-xs font-semibold text-white/60">Kitchen</span>
              <span className="px-3 py-1.5 text-xs font-semibold text-white/60">Bedrooms</span>
            </div>
            <div className="absolute inset-x-4 bottom-4 grid max-w-sm grid-cols-3 gap-2">
              {[
                [String(apartment.rooms), apartment.rooms === 1 ? "Room" : "Rooms"],
                [String(apartment.bathrooms), apartment.bathrooms === 1 ? "Bathroom" : "Bathrooms"],
                [String(apartment.sqm), "Sq. Mtrs"],
              ].map(([v, l]) => (
                <div
                  key={l}
                  className="rounded-2xl bg-onyx/75 px-3 py-2.5 text-center text-white backdrop-blur-sm"
                >
                  <p className="text-xl font-extrabold">{v}</p>
                  <p className="text-[10px] text-white/70">{l}</p>
                </div>
              ))}
            </div>
          </div>

          {/* stats */}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard emphasis label="Monthly rent" value={fmt(apartment.rent)} hint={`${apartment.cycle} lease`} />
            <StatCard
              label="Net yield"
              value={apartment.tenant ? `${apartment.netYield}%` : "N/A"}
              hint={apartment.tenant ? "year to date" : "currently vacant"}
            />
            <StatCard
              label="Current status"
              value={apartment.tenant ? (apartment.rentStatus === "paid" ? "Paid" : apartment.rentStatus === "pending" ? "Pending" : "Overdue") : "To let"}
              hint={apartment.tenant ? "August rent" : "no active lease"}
            />
            <StatCard label="Open tickets" value={String(aptTickets.filter((t) => t.status !== "resolved").length)} hint="maintenance" />
          </div>

          {/* payment history */}
          <Card>
            <CardTitle>Payment history</CardTitle>
            {apartment.payments.length === 0 ? (
              <p className="text-sm text-white/45">
                No payments yet. This apartment is waiting for its first lease.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[480px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-white/10 text-xs uppercase tracking-wide text-white/40">
                      <th className="pb-3 font-semibold">Period</th>
                      <th className="pb-3 font-semibold">Amount</th>
                      <th className="pb-3 font-semibold">Paid on</th>
                      <th className="pb-3 text-right font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...apartment.payments].reverse().map((p) => (
                      <tr key={p.month} className="border-b border-white/10 last:border-0">
                        <td className="py-3.5 font-semibold text-white">{p.month}</td>
                        <td className="py-3.5 text-white/75">{fmt(p.amount)}</td>
                        <td className="py-3.5 text-white/60">{p.paidOn ?? "Not paid"}</td>
                        <td className="py-3.5 text-right">
                          <RentChip status={p.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>

        {/* ---------- right column ---------- */}
        <div className="space-y-6">
          {/* tenant */}
          <Card>
            <CardTitle>Tenant</CardTitle>
            {apartment.tenant ? (
              <div>
                <div className="flex items-center gap-3.5">
                  <span className="grid h-12 w-12 place-items-center rounded-full bg-azure-800 text-sm font-bold text-soft-500">
                    {apartment.tenant.name.split(" ").map((w) => w[0]).join("")}
                  </span>
                  <div>
                    <p className="font-bold text-white">{apartment.tenant.name}</p>
                    <p className="text-xs text-white/45">Tenant since {apartment.tenant.since}</p>
                  </div>
                </div>
                <dl className="mt-5 space-y-2.5 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-white/45">Phone / WhatsApp</dt>
                    <dd className="font-medium text-white">{apartment.tenant.phone}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-white/45">Lease cycle</dt>
                    <dd className="font-medium capitalize text-white">{apartment.cycle}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-white/45">Rent</dt>
                    <dd className="font-medium text-white">{fmt(apartment.rent)} / month</dd>
                  </div>
                </dl>
                <button className="mt-5 w-full rounded-full border border-white/15 py-2.5 text-sm font-semibold text-soft-500 transition hover:bg-white/10">
                  Message on WhatsApp
                </button>
              </div>
            ) : (
              <p className="text-sm text-white/45">
                Vacant. Add a lease to start collecting rent and tracking yield.
              </p>
            )}
          </Card>

          {/* activity */}
          <Card>
            <div className="mb-1 flex items-center justify-between">
              <h2 className="text-[15px] font-bold text-white">Building activity</h2>
              <span className="text-xs text-white/45">August 2026</span>
            </div>

            <div className="mt-4 grid grid-cols-7 gap-1">
              {WEEK.map((d) => (
                <div
                  key={d.day}
                  className={`rounded-2xl py-2.5 text-center ${
                    d.active ? "bg-azure-800 text-white" : "text-white/55"
                  }`}
                >
                  <p className="text-sm font-bold">{d.day}</p>
                  <p className={`text-[10px] ${d.active ? "text-soft-500" : "text-white/35"}`}>
                    {d.label}
                  </p>
                </div>
              ))}
            </div>

            <p className="mt-6 text-xs font-semibold uppercase tracking-wide text-white/40">
              On duty today
            </p>
            <div className="mt-2.5 flex -space-x-2">
              {team.map((t) => (
                <span
                  key={t}
                  className="grid h-9 w-9 place-items-center rounded-full border-2 border-white bg-azure-800 text-[11px] font-bold text-soft-500"
                >
                  {t}
                </span>
              ))}
            </div>

            <div className="mt-6 space-y-4">
              {schedule.map((item) => (
                <div key={`${item.time}-${item.title}`} className="flex gap-3">
                  <div className="w-12 shrink-0 pt-3 text-right">
                    <p className="text-sm font-bold text-white">{item.time}</p>
                  </div>
                  <div
                    className={`flex-1 rounded-2xl p-4 ${
                      item.kind === "viewing"
                        ? "bg-soft-200 text-azure-950"
                        : "border border-white/10 bg-white/8 text-white"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-bold">{item.title}</p>
                        <p className={`mt-0.5 text-xs ${item.kind === "viewing" ? "text-white/60" : "text-white/65"}`}>
                          {item.detail}
                        </p>
                      </div>
                      <span
                        className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-[10px] font-bold ${
                          item.kind === "viewing"
                            ? "bg-white text-azure-950"
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
          </Card>

          {/* maintenance history */}
          <Card>
            <CardTitle>Maintenance</CardTitle>
            {aptTickets.length === 0 ? (
              <p className="text-sm text-white/45">No tickets for this apartment.</p>
            ) : (
              <div className="space-y-3.5">
                {aptTickets.map((t) => (
                  <div key={t.id} className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold text-white">{t.title}</p>
                      <p className="text-xs text-white/45">opened {t.openedOn}</p>
                    </div>
                    <TicketChip status={t.status} />
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
