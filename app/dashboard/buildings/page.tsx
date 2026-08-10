import Image from "next/image";
import Link from "next/link";
import { buildings, fmt } from "@/lib/data";
import { PageTitle, ProgressBar } from "@/components/dashboard/ui";

function SpecChip({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <span className="flex items-center gap-1.5 rounded-full border border-azure-900/10 dark:border-white/10 px-3 py-1.5 text-xs font-semibold text-onyx/60 dark:text-white/60">
      <span className="text-azure-600 dark:text-soft-500">{icon}</span>
      {label}
    </span>
  );
}

const icons = {
  apartments: (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 21h18M5 21V5a1 1 0 011-1h7a1 1 0 011 1v16M14 9h4a1 1 0 011 1v11M8 8h2M8 12h2M8 16h2" />
    </svg>
  ),
  occupied: (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8" />
    </svg>
  ),
  sqm: (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="4" width="16" height="16" rx="2" />
    </svg>
  ),
};

export default function BuildingsPage() {
  return (
    <>
      <PageTitle
        title="Property inventory"
        subtitle="Manage and track your entire portfolio."
        action={
          <div className="flex items-center gap-3">
            <button
              aria-label="Filter"
              className="grid h-12 w-12 place-items-center rounded-full border border-azure-900/10 dark:border-white/10 text-azure-950 dark:text-white transition hover:bg-azure-900/10 dark:hover:bg-white/10"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 3H2l8 9.5V19l4 2v-8.5L22 3z" />
              </svg>
            </button>
            <button className="rounded-full bg-onyx px-6 py-3 text-sm font-semibold text-white transition hover:bg-azure-900 dark:bg-soft-500 dark:text-azure-950 dark:hover:bg-soft-400">
              Add building
            </button>
          </div>
        }
      />

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {buildings.map((b) => {
          const occ = b.apartments.filter((a) => a.tenant).length;
          const overdue = b.apartments.filter((a) => a.rentStatus === "overdue").length;
          const sqm = b.apartments.reduce((s, a) => s + a.sqm, 0);
          const rentRoll = b.apartments
            .filter((a) => a.tenant)
            .reduce((s, a) => s + a.rent, 0);
          const healthy = overdue === 0;
          return (
            <div
              key={b.id}
              className="group rounded-[2rem] border border-azure-900/8 dark:border-white/8 bg-white/[0.04] p-2.5 transition hover:border-white/20"
            >
              <Link href={`/dashboard/buildings/${b.id}`} className="relative block h-48 overflow-hidden rounded-[1.6rem]">
                <Image
                  src={b.photo}
                  alt={b.name}
                  fill
                  className="object-cover transition duration-500 group-hover:scale-105"
                />
                <span
                  className={`absolute left-3.5 top-3.5 rounded-full px-3.5 py-1.5 text-xs font-bold backdrop-blur-sm ${
                    healthy ? "bg-white/85 text-azure-950" : "bg-onyx/85 text-white"
                  }`}
                >
                  {healthy ? "Healthy" : `${overdue} overdue`}
                </span>
                <span className="absolute right-3.5 top-3.5 rounded-full bg-white/85 px-3.5 py-1.5 text-xs font-bold text-azure-950 backdrop-blur-sm">
                  {b.netYield}% yield
                </span>
              </Link>

              <div className="px-3.5 pb-3.5 pt-5">
                <h2 className="text-lg font-bold text-azure-950 dark:text-white">{b.name}</h2>
                <p className="mt-1 flex items-center gap-1.5 text-sm text-onyx/45 dark:text-white/45">
                  <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-azure-600 dark:text-soft-500" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 1118 0z" /><circle cx="12" cy="10" r="3" />
                  </svg>
                  {b.address}, {b.city}
                </p>

                <p className="mt-3.5 text-3xl font-extrabold tracking-tight text-azure-950 dark:text-white">
                  {fmt(rentRoll)}
                  <span className="ml-1.5 text-sm font-medium text-onyx/40 dark:text-white/40">/ month</span>
                </p>

                <div className="mt-4 flex flex-wrap gap-2">
                  <SpecChip icon={icons.apartments} label={`${b.apartments.length} apartments`} />
                  <SpecChip icon={icons.occupied} label={`${occ} occupied`} />
                  <SpecChip icon={icons.sqm} label={`${sqm} m²`} />
                </div>

                <div className="mt-5">
                  <ProgressBar pct={(occ / b.apartments.length) * 100} />
                  <div className="mt-2 flex items-center justify-between text-xs text-onyx/45 dark:text-white/45">
                    <span>Leased at {Math.round((occ / b.apartments.length) * 100)}%</span>
                    <span>{fmt(b.incomeYtd)} income YTD</span>
                  </div>
                </div>

                <Link
                  href={`/dashboard/buildings/${b.id}`}
                  className={`mt-5 block rounded-full py-3 text-center text-sm font-semibold transition ${
                    healthy
                      ? "border border-azure-900/15 dark:border-white/15 text-azure-950 dark:text-white hover:bg-soft-500 hover:text-azure-950"
                      : "bg-soft-500 text-azure-950 hover:bg-soft-400"
                  }`}
                >
                  View details
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
