import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { activity, buildings, fmt, getBuilding, tickets } from "@/lib/data";
import { Card, CardTitle, ProgressBar, ViaBadge } from "@/components/dashboard/ui";

export function generateStaticParams() {
  return buildings.map((b) => ({ id: b.id }));
}

const UNIT_PHOTOS = [
  "/photos/interior-2.jpg",
  "/photos/interior-3.jpg",
  "/photos/interior-4.jpg",
  "/photos/interior-1.jpg",
];

function PriorityChip({ daysOpen }: { daysOpen: number }) {
  const [label, cls] =
    daysOpen >= 5
      ? ["Urgent", "bg-white text-onyx"]
      : daysOpen >= 3
        ? ["High", "bg-soft-500 text-azure-950"]
        : ["Normal", "border border-white/15 text-white/70"];
  return (
    <span className={`inline-block rounded-full px-3.5 py-1 text-[11px] font-bold uppercase tracking-wide ${cls}`}>
      {label}
    </span>
  );
}

function Initials({ text, dark = false }: { text: string; dark?: boolean }) {
  const initials = text
    .split(" ")
    .filter((w) => /^[A-ZÀ-Ü]/.test(w))
    .slice(0, 2)
    .map((w) => w[0])
    .join("");
  return (
    <span
      className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-[11px] font-bold ${
        dark ? "bg-azure-800 text-soft-500" : "bg-soft-200 text-azure-950"
      }`}
    >
      {initials}
    </span>
  );
}

/* multi-segment donut in brand tones */
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
        <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="11" />
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
          <p className="text-2xl font-extrabold text-white">{total}</p>
          <p className="text-[11px] text-white/45">total</p>
        </div>
      </div>
    </div>
  );
}

export default async function BuildingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const building = getBuilding(id);
  if (!building) notFound();

  const occ = building.apartments.filter((a) => a.tenant);
  const vacant = building.apartments.length - occ.length;
  const rentCollected = occ
    .filter((a) => a.rentStatus === "paid")
    .reduce((s, a) => s + a.rent, 0);
  const debt = occ
    .filter((a) => a.rentStatus === "overdue")
    .reduce((s, a) => s + a.rent, 0);
  const services = Math.round(rentCollected * 0.08);
  const maintenanceCost = Math.round(building.expensesYtd / 8);

  const bTickets = tickets.filter((t) => t.buildingId === building.id);
  const delayed = bTickets.filter((t) => t.status !== "resolved" && t.daysOpen >= 3);
  const fresh = bTickets.filter((t) => t.status === "new");
  const counts = {
    new: bTickets.filter((t) => t.status === "new").length,
    progress: bTickets.filter((t) => t.status === "in-progress").length,
    assigned: bTickets.filter((t) => t.status === "assigned").length,
    resolved: bTickets.filter((t) => t.status === "resolved").length,
  };
  const viewings = activity.filter(
    (a) => a.buildingId === building.id && a.kind === "viewing"
  ).length;

  return (
    <>
      {/* header */}
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard/buildings"
            aria-label="Back to buildings"
            className="grid h-11 w-11 place-items-center rounded-full border border-white/10 text-white transition hover:bg-white/10"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M11 18l-6-6 6-6" />
            </svg>
          </Link>
          <div>
            <h1 className="font-serif text-3xl font-medium tracking-tight text-white sm:text-4xl">
              {building.name}
            </h1>
            <p className="mt-0.5 flex items-center gap-1.5 text-sm text-white/50">
              <svg viewBox="0 0 24 24" className="h-4 w-4 text-soft-500" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 1118 0z" /><circle cx="12" cy="10" r="3" />
              </svg>
              {building.address} · {building.city}
            </p>
          </div>
        </div>
        <button className="rounded-full bg-soft-500 px-6 py-3 text-sm font-semibold text-azure-950 transition hover:bg-soft-400">
          Add apartment
        </button>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.7fr_1fr]">
        {/* ---------- main column ---------- */}
        <div className="space-y-6">
          {/* payments */}
          <Card>
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-[15px] font-bold text-white">Payments</h2>
              <span className="rounded-full bg-soft-100 px-3.5 py-1.5 text-xs font-semibold text-azure-950">
                This month
              </span>
            </div>
            <div className="grid grid-cols-2 gap-6 lg:grid-cols-4">
              <div>
                <p className="text-2xl font-extrabold tracking-tight text-white">{fmt(rentCollected)}</p>
                <p className="mt-0.5 text-xs text-white/45">Rent collected</p>
              </div>
              <div>
                <p className="text-2xl font-extrabold tracking-tight text-white">{fmt(services)}</p>
                <p className="mt-0.5 text-xs text-white/45">Charges and services</p>
              </div>
              <div>
                <p className="text-2xl font-extrabold tracking-tight text-white">{fmt(maintenanceCost)}</p>
                <p className="mt-0.5 text-xs text-white/45">Maintenance</p>
              </div>
              <div>
                <p className="flex items-center gap-1.5 text-2xl font-extrabold tracking-tight text-white">
                  <span className="grid h-5 w-5 place-items-center rounded-full bg-white text-[11px] font-bold text-onyx">!</span>
                  {fmt(debt)}
                </p>
                <p className="mt-0.5 text-xs text-white/45">Outstanding debt</p>
              </div>
            </div>
          </Card>

          {/* delayed work orders */}
          <Card>
            <CardTitle action={{ label: "All tickets", href: "/dashboard/maintenance" }}>
              Delayed work orders
            </CardTitle>
            {delayed.length === 0 ? (
              <p className="text-sm text-white/45">Nothing is running late. Well kept.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-left text-sm">
                  <tbody>
                    {delayed.map((t) => (
                      <tr key={t.id} className="border-b border-white/10 last:border-0">
                        <td className="py-3.5 text-xs font-semibold text-white/40">{t.id}</td>
                        <td className="py-3.5 font-semibold text-white">{t.apartment}</td>
                        <td className="py-3.5 text-white/70">{t.title}</td>
                        <td className="py-3.5">
                          {t.assignee ? (
                            <span className="flex items-center gap-2.5">
                              <Initials text={t.assignee} dark />
                              <span className="text-white/60">{t.assignee}</span>
                            </span>
                          ) : (
                            <span className="italic text-white/35">Unassigned</span>
                          )}
                        </td>
                        <td className="whitespace-nowrap py-3.5 text-white/55">
                          {t.daysOpen} days open
                        </td>
                        <td className="py-3.5 text-right">
                          <PriorityChip daysOpen={t.daysOpen} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {/* new requests */}
          <Card>
            <CardTitle action={{ label: "Maintenance", href: "/dashboard/maintenance" }}>
              New requests
            </CardTitle>
            {fresh.length === 0 ? (
              <p className="text-sm text-white/45">No new requests today.</p>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {fresh.map((t) => (
                  <div key={t.id} className="rounded-2xl border border-white/10 p-4">
                    <div className="flex items-center gap-3">
                      <Initials text={t.apartment} />
                      <div>
                        <p className="text-sm font-bold text-white">{t.apartment}</p>
                        <p className="text-xs text-white/45">reported {t.openedOn}</p>
                      </div>
                    </div>
                    <p className="mt-3 text-sm leading-relaxed text-white/65">
                      {t.title}. Awaiting assignment to a contractor.
                    </p>
                    <div className="mt-3">
                      <ViaBadge via={t.reportedVia} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* apartments as unit cards */}
          <Card>
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-[15px] font-bold text-white">Apartments</h2>
              <span className="rounded-full bg-soft-100 px-3.5 py-1.5 text-xs font-semibold text-azure-950">
                {building.apartments.length} units
              </span>
            </div>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {building.apartments.map((a, i) => (
                <Link
                  key={a.id}
                  href={`/dashboard/buildings/${building.id}/${a.id}`}
                  className="group/unit block"
                >
                  <div className="relative h-36 overflow-hidden rounded-2xl">
                    <Image
                      src={UNIT_PHOTOS[i % UNIT_PHOTOS.length]}
                      alt={a.label}
                      fill
                      className="object-cover transition duration-500 group-hover/unit:scale-105"
                    />
                    <span
                      className={`absolute left-3 top-3 rounded-full px-3 py-1 text-[11px] font-bold backdrop-blur-sm ${
                        !a.tenant
                          ? "bg-white/90 text-azure-950"
                          : a.rentStatus === "overdue"
                            ? "bg-onyx/85 text-white"
                            : "bg-white/105 text-white"
                      }`}
                    >
                      {!a.tenant ? "To let" : a.rentStatus === "overdue" ? "Overdue" : "Occupied"}
                    </span>
                  </div>
                  <div className="mt-3 flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-bold text-white group-hover/unit:text-soft-500">
                        {a.label}
                      </p>
                      <p className="text-xs text-white/45">
                        {a.rooms} {a.rooms === 1 ? "room" : "rooms"} · {a.sqm} m²
                      </p>
                    </div>
                    <p className="text-sm font-extrabold text-white">
                      {fmt(a.rent)}
                      <span className="text-xs font-medium text-white/40"> /m</span>
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </Card>
        </div>

        {/* ---------- right column ---------- */}
        <div className="space-y-6">
          {/* building summary */}
          <Card className="p-0 overflow-hidden">
            <div className="relative h-52">
              <Image src={building.photo} alt={building.name} fill className="object-cover" />
            </div>
            <div className="p-6">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-white">{building.name}</h2>
                <span className="grid h-9 w-9 place-items-center rounded-full bg-soft-100 text-azure-950">
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M7 17L17 7M9 7h8v8" />
                  </svg>
                </span>
              </div>
              <div className="mt-5 grid grid-cols-4 gap-2 text-center">
                {[
                  [String(occ.length), "Residents"],
                  [String(building.apartments.length), "Units"],
                  [String(vacant), "Vacant"],
                  [String(viewings), "Viewings"],
                ].map(([v, l]) => (
                  <div key={l}>
                    <p className="text-xl font-extrabold text-white">{v}</p>
                    <p className="text-[11px] text-white/45">{l}</p>
                  </div>
                ))}
              </div>
              <ProgressBar
                pct={(occ.length / building.apartments.length) * 100}
                className="mt-5"
              />
              <p className="mt-2 text-xs text-white/45">
                Leased at {Math.round((occ.length / building.apartments.length) * 100)}%
              </p>
            </div>
          </Card>

          {/* work orders donut */}
          <Card>
            <CardTitle action={{ label: "Open", href: "/dashboard/maintenance" }}>
              Work orders
            </CardTitle>
            <div className="flex items-center gap-6">
              <WorkOrdersDonut
                total={bTickets.length}
                segments={[
                  { value: counts.new, color: "#ffffff" },
                  { value: counts.assigned, color: "#addfe1" },
                  { value: counts.progress, color: "#14639b" },
                  { value: counts.resolved, color: "rgba(255,255,255,0.3)" },
                ]}
              />
              <div className="grid flex-1 grid-cols-2 gap-x-4 gap-y-3 text-sm">
                {[
                  [counts.new, "New", "bg-white"],
                  [counts.assigned, "Assigned", "bg-soft-500"],
                  [counts.progress, "In progress", "bg-azure-600"],
                  [counts.resolved, "Resolved", "bg-white/30"],
                ].map(([v, l, dot]) => (
                  <div key={l as string}>
                    <p className="flex items-center gap-2 text-lg font-extrabold text-white">
                      <span className={`h-2.5 w-2.5 rounded-full ${dot}`} />
                      {v}
                    </p>
                    <p className="text-[11px] text-white/45">{l}</p>
                  </div>
                ))}
              </div>
            </div>
          </Card>

          {/* on site staff */}
          <Card>
            <CardTitle>On site staff</CardTitle>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-white/40">
                  Caretaker
                </p>
                <p className="mt-1 font-bold text-white">Fatou Ba</p>
                <p className="text-xs text-white/50">+1 555 014 0021</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-white/40">
                  Maintenance
                </p>
                <p className="mt-1 font-bold text-white">B. Keita</p>
                <p className="text-xs text-white/50">+1 555 014 0764</p>
              </div>
            </div>
            <div className="mt-5 flex items-center gap-3 border-t border-white/10 pt-4">
              <div className="flex -space-x-2">
                {["FB", "BK", "SD", "MF"].map((t) => (
                  <span
                    key={t}
                    className="grid h-8 w-8 place-items-center rounded-full border-2 border-white bg-azure-800 text-[10px] font-bold text-soft-500"
                  >
                    {t}
                  </span>
                ))}
              </div>
              <p className="text-xs text-white/50">8 staff members across the portfolio</p>
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
