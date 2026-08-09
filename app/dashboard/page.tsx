import Image from "next/image";
import Link from "next/link";
import { buildings, fmt, occupancy, tickets } from "@/lib/data";
import { Card, CardTitle } from "@/components/dashboard/ui";

const featured = buildings[2]; // Villa Andalouse
const rentRoll = (id: string) =>
  buildings
    .find((b) => b.id === id)!
    .apartments.filter((a) => a.tenant)
    .reduce((s, a) => s + a.rent, 0);

/* ---------- portfolio donut ---------- */

function PortfolioDonut() {
  const total = buildings.reduce((s, b) => s + b.incomeYtd, 0);
  const colors = ["#addfe1", "#14639b", "var(--donut-strong)"];
  const C = 2 * Math.PI * 44;
  let offset = 0;
  return (
    <div className="relative mx-auto h-52 w-52">
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
        <circle cx="50" cy="50" r="44" fill="none" stroke="var(--donut-track)" strokeWidth="8" />
        {buildings.map((b, i) => {
          const len = (b.incomeYtd / total) * C - 2;
          const el = (
            <circle
              key={b.id}
              cx="50" cy="50" r="44" fill="none"
              stroke={colors[i]} strokeWidth="8" strokeLinecap="round"
              strokeDasharray={`${len} ${C}`}
              strokeDashoffset={-offset}
            />
          );
          offset += len + 2;
          return el;
        })}
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <p className="text-xs text-onyx/45 dark:text-white/45">Portfolio income</p>
          <p className="mt-1 text-3xl font-extrabold tracking-tight text-azure-950 dark:text-white">
            ${Math.round(total / 1000)}k
          </p>
          <p className="mt-1 text-sm font-semibold text-azure-600 dark:text-soft-500">+12.4%</p>
          <p className="text-[11px] text-onyx/40 dark:text-white/40">vs last year</p>
        </div>
      </div>
    </div>
  );
}

/* ---------- recent activity ---------- */

const ACTIVITY = [
  {
    title: "Rent payment received",
    detail: "Apt 1A · Mariam Diallo",
    time: "2 hours ago",
    photo: "/photos/interior-2.jpg",
    icon: (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 6L9 17l-5-5" />
      </svg>
    ),
  },
  {
    title: "Ticket resolved",
    detail: "Balcony door seal · Villa Andalouse",
    time: "Yesterday",
    photo: "/photos/interior-3.jpg",
    icon: (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14.7 6.3a4.5 4.5 0 00-6 6L3 18l3 3 5.7-5.7a4.5 4.5 0 006-6L15 12l-3-3 2.7-2.7z" />
      </svg>
    ),
  },
  {
    title: "New lease signed",
    detail: "Terrace Suite · Omar Sy",
    time: "2 days ago",
    photo: "/photos/interior-4.jpg",
    icon: (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8zM14 2v6h6M9 13h6M9 17h4" />
      </svg>
    ),
  },
];

/* ---------- rent follow up steps ---------- */

const STEPS = ["Reminder", "Follow up", "Escalation", "Paid"];

function FollowUpRow({
  name,
  unit,
  building,
  buildingId,
  aptId,
  amount,
  step,
  photo,
}: {
  name: string;
  unit: string;
  building: string;
  buildingId: string;
  aptId: string;
  amount: number;
  step: number;
  photo: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-5 rounded-2xl border border-azure-900/8 dark:border-white/8 p-4">
      <Link
        href={`/dashboard/buildings/${buildingId}/${aptId}`}
        className="flex min-w-56 items-center gap-3.5"
      >
        <Image
          src={photo}
          alt={unit}
          width={160}
          height={112}
          className="h-14 w-20 shrink-0 rounded-xl object-cover"
        />
        <div>
          <p className="text-sm font-bold text-azure-950 dark:text-white transition hover:text-azure-600 dark:hover:text-soft-500">
            {unit} · {name}
          </p>
          <p className="text-xs text-onyx/45 dark:text-white/45">
            {building} · {fmt(amount)} due
          </p>
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
        className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-soft-500 text-azure-950 transition hover:bg-soft-400"
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
  const { total, occupied } = occupancy();
  const openTickets = tickets.filter((t) => t.status !== "resolved").length;
  const featuredOcc = featured.apartments.filter((a) => a.tenant).length;

  return (
    <>
      <h1 className="font-serif text-3xl font-medium tracking-tight sm:text-4xl">
        <span className="text-onyx/50 dark:text-white/50">Good morning,</span>{" "}
        <span className="text-azure-950 dark:text-white">Amina</span>
      </h1>
      <p className="mt-1.5 text-[15px] text-onyx/40 dark:text-white/40">
        Here is how your portfolio stands today, 8 August 2026.
      </p>

      <div className="mt-8 grid gap-6 xl:grid-cols-[1.65fr_1fr]">
        {/* ---------- left column ---------- */}
        <div className="space-y-6">
          {/* featured building */}
          <div className="relative overflow-hidden rounded-[2rem]">
            <Image
              src={featured.photo}
              alt={featured.name}
              width={1600}
              height={1067}
              className="h-[400px] w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-onyx/85 via-onyx/45 to-onyx/10" />
            <div className="absolute inset-0 flex flex-col justify-between p-8">
              <div className="flex flex-wrap gap-2">
                <span className="flex items-center gap-1.5 rounded-full bg-soft-500 px-4 py-1.5 text-xs font-bold text-azure-950">
                  <svg viewBox="0 0 20 20" className="h-3.5 w-3.5 fill-current">
                    <path d="M10 1.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L10 14.9l-5.2 2.7 1-5.8L1.5 7.7l5.9-.9L10 1.5z" />
                  </svg>
                  Top yield
                </span>
                <span className="rounded-full border border-white/25 bg-onyx/40 px-4 py-1.5 text-xs font-semibold text-white backdrop-blur-sm">
                  {featured.netYield}% net
                </span>
                <span className="rounded-full border border-white/25 bg-onyx/40 px-4 py-1.5 text-xs font-semibold text-white backdrop-blur-sm">
                  Fully leased
                </span>
              </div>
              <div>
                <h2 className="font-serif text-4xl font-medium tracking-tight text-white">
                  {featured.name}
                </h2>
                <p className="mt-1.5 flex items-center gap-1.5 text-sm text-white/70">
                  <svg viewBox="0 0 24 24" className="h-4 w-4 text-soft-500" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 1118 0z" /><circle cx="12" cy="10" r="3" />
                  </svg>
                  {featured.address} · {featured.city}
                </p>
                <p className="mt-3 max-w-md text-sm leading-relaxed text-white/75">
                  {featured.apartments.length} suites, {featuredOcc} leased, and
                  the strongest return in your portfolio. {fmt(featured.incomeYtd)}{" "}
                  of income so far this year.
                </p>
                <div className="mt-5 flex flex-wrap items-center gap-4">
                  <div className="flex -space-x-2">
                    {featured.apartments
                      .filter((a) => a.tenant)
                      .map((a) => (
                        <span
                          key={a.id}
                          className="grid h-9 w-9 place-items-center rounded-full border-2 border-onyx/60 bg-azure-800 text-[10px] font-bold text-soft-500"
                        >
                          {a.tenant!.name.split(" ").map((w) => w[0]).join("")}
                        </span>
                      ))}
                  </div>
                  <Link
                    href={`/dashboard/buildings/${featured.id}`}
                    className="rounded-full bg-soft-500 px-6 py-2.5 text-sm font-bold text-azure-950 transition hover:bg-soft-400"
                  >
                    View details
                  </Link>
                </div>
              </div>
            </div>
          </div>

          {/* recent activity */}
          <Card>
            <CardTitle action={{ label: "See more", href: "/dashboard/rent" }}>
              Recent activity
            </CardTitle>
            <div className="grid gap-4 sm:grid-cols-3">
              {ACTIVITY.map((a) => (
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
            <div className="space-y-4">
              <FollowUpRow
                name="Jonas Petit"
                unit="Apt 2B"
                building="Résidence Les Palmiers"
                buildingId="palmiers"
                aptId="a4"
                amount={780}
                step={2}
                photo="/photos/interior-2.jpg"
              />
              <FollowUpRow
                name="Daniel Mensah"
                unit="Apt 102"
                building="Immeuble Océan"
                buildingId="ocean"
                aptId="a2"
                amount={1250}
                step={1}
                photo="/photos/interior-4.jpg"
              />
            </div>
          </Card>
        </div>

        {/* ---------- right column ---------- */}
        <div className="space-y-6">
          {/* buildings list */}
          <Card>
            <CardTitle action={{ label: "View all", href: "/dashboard/buildings" }}>
              Your buildings
            </CardTitle>
            <div className="space-y-2">
              {buildings.map((b) => (
                <Link
                  key={b.id}
                  href={`/dashboard/buildings/${b.id}`}
                  className="-mx-2 flex items-center gap-4 rounded-2xl px-2 py-2.5 transition hover:bg-azure-900/5 dark:hover:bg-white/5"
                >
                  <Image
                    src={b.photo}
                    alt={b.name}
                    width={112}
                    height={112}
                    className="h-14 w-14 shrink-0 rounded-2xl object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-azure-950 dark:text-white">{b.name}</p>
                    <p className="truncate text-xs text-onyx/45 dark:text-white/45">{b.city}</p>
                    <p className="mt-0.5 text-sm font-semibold text-azure-600 dark:text-soft-500">
                      {fmt(rentRoll(b.id))}
                      <span className="text-xs font-normal text-onyx/40 dark:text-white/40"> / month</span>
                    </p>
                  </div>
                  <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-onyx/30 dark:text-white/30" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 18l6-6-6-6" />
                  </svg>
                </Link>
              ))}
            </div>
          </Card>

          {/* portfolio overview */}
          <Card>
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-[15px] font-bold text-azure-950 dark:text-white">Portfolio overview</h2>
              <span className="rounded-full border border-azure-900/10 dark:border-white/10 px-3.5 py-1.5 text-xs font-semibold text-onyx/55 dark:text-white/55">
                This year
              </span>
            </div>
            <PortfolioDonut />
            <div className="mt-4 space-y-2">
              {buildings.map((b, i) => (
                <div key={b.id} className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-2 text-onyx/55 dark:text-white/55">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: ["#addfe1", "#14639b", "var(--donut-strong)"][i] }}
                    />
                    {b.name}
                  </span>
                  <span className="font-semibold text-onyx/75 dark:text-white/75">{fmt(b.incomeYtd)}</span>
                </div>
              ))}
            </div>
            <div className="mt-6 grid grid-cols-3 gap-3 border-t border-azure-900/8 dark:border-white/8 pt-6 text-center">
              {[
                [`${Math.round((occupied / total) * 100)}%`, "Occupancy"],
                [String(total), "Apartments"],
                [String(openTickets), "Open tickets"],
              ].map(([v, l]) => (
                <div key={l}>
                  <span className="mx-auto mb-2 grid h-11 w-11 place-items-center rounded-full border border-azure-900/12 dark:border-white/12 text-azure-600 dark:text-soft-500">
                    {l === "Occupancy" ? (
                      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 21h18M5 21V10l7-6 7 6v11" />
                      </svg>
                    ) : l === "Apartments" ? (
                      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="4" y="3" width="16" height="18" rx="2" /><path d="M9 8h2M13 8h2M9 12h2M13 12h2M9 16h2M13 16h2" />
                      </svg>
                    ) : (
                      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14.7 6.3a4.5 4.5 0 00-6 6L3 18l3 3 5.7-5.7a4.5 4.5 0 006-6L15 12l-3-3 2.7-2.7z" />
                      </svg>
                    )}
                  </span>
                  <p className="text-lg font-extrabold text-azure-950 dark:text-white">{v}</p>
                  <p className="text-[11px] text-onyx/40 dark:text-white/40">{l}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
