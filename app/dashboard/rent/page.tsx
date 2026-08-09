import Image from "next/image";
import Link from "next/link";
import { allApartments, collections, fmt } from "@/lib/data";
import { PageTitle, RentChip } from "@/components/dashboard/ui";

function FilterButton({ children }: { children: React.ReactNode }) {
  return (
    <button className="flex items-center gap-2 rounded-2xl border border-azure-900/10 bg-white px-4 py-2.5 text-sm font-semibold text-azure-950 transition hover:bg-azure-900/5 dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:bg-white/10">
      {children}
      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-onyx/40 dark:text-white/40" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 9l6 6 6-6" />
      </svg>
    </button>
  );
}

export default function RentPage() {
  const leased = allApartments().filter((a) => a.tenant);
  const august = collections[collections.length - 1];
  const paid = leased.filter((a) => a.rentStatus === "paid").length;
  const pending = leased.filter((a) => a.rentStatus === "pending").length;
  const overdue = leased.filter((a) => a.rentStatus === "overdue").length;

  const tabs = [
    { label: "All leases", count: leased.length, active: true },
    { label: "Paid", count: paid, active: false },
    { label: "Pending", count: pending, active: false },
    { label: "Overdue", count: overdue, active: false },
  ];

  return (
    <>
      <PageTitle
        title="Rent collection"
        subtitle={`August 2026 · ${fmt(august.collected)} collected of ${fmt(august.due)} due.`}
        action={
          <div className="flex items-center gap-3">
            <button className="flex items-center gap-2 rounded-full border border-azure-900/15 px-5 py-3 text-sm font-semibold text-azure-950 transition hover:bg-azure-900/5 dark:border-white/15 dark:text-white dark:hover:bg-white/10">
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 3v12M8 11l4 4 4-4M4 21h16" />
              </svg>
              Export
            </button>
            <button className="rounded-full bg-soft-500 px-6 py-3 text-sm font-semibold text-azure-950 transition hover:bg-soft-400">
              Record a payment
            </button>
          </div>
        }
      />

      {/* tabs */}
      <div className="mb-6 flex gap-7 overflow-x-auto border-b border-azure-900/10 dark:border-white/10">
        {tabs.map((t) => (
          <button
            key={t.label}
            className={`-mb-px flex shrink-0 items-center gap-2 border-b-2 pb-3 text-[15px] font-semibold transition ${
              t.active
                ? "border-azure-800 text-azure-950 dark:border-soft-500 dark:text-white"
                : "border-transparent text-onyx/45 hover:text-azure-950 dark:text-white/45 dark:hover:text-white"
            }`}
          >
            {t.label}
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                t.active
                  ? "bg-soft-500 text-azure-950"
                  : "bg-azure-900/8 text-onyx/50 dark:bg-white/10 dark:text-white/50"
              }`}
            >
              {t.count}
            </span>
          </button>
        ))}
      </div>

      {/* table card */}
      <div className="rounded-3xl border border-azure-900/8 bg-white shadow-sm shadow-azure-900/5 dark:border-white/8 dark:bg-white/[0.04] dark:shadow-none">
        {/* card header */}
        <div className="flex flex-wrap items-center justify-between gap-4 p-6">
          <p className="text-lg font-bold text-azure-950 dark:text-white">
            Leases{" "}
            <span className="ml-1 text-sm font-medium text-onyx/40 dark:text-white/40">
              Total {leased.length}
            </span>
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2.5 rounded-2xl border border-azure-900/10 bg-white px-4 py-2.5 dark:border-white/10 dark:bg-white/5">
              <svg viewBox="0 0 24 24" className="h-4 w-4 text-onyx/35 dark:text-white/35" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" />
              </svg>
              <input
                placeholder="Search tenants"
                className="w-40 bg-transparent text-sm text-azure-950 outline-none placeholder:text-onyx/35 dark:text-white dark:placeholder:text-white/35"
              />
            </div>
            <FilterButton>Building</FilterButton>
            <FilterButton>Status</FilterButton>
            <button className="flex items-center gap-2 rounded-2xl border border-azure-900/10 bg-white px-4 py-2.5 text-sm font-semibold text-azure-950 transition hover:bg-azure-900/5 dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:bg-white/10">
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 6h16M7 12h10M10 18h4" />
              </svg>
              Filter
            </button>
          </div>
        </div>

        {/* table */}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[880px] text-left text-sm">
            <thead>
              <tr className="border-y border-azure-900/8 bg-soft-50 text-xs text-onyx/45 dark:border-white/8 dark:bg-white/[0.03] dark:text-white/40">
                <th className="px-6 py-3.5 font-semibold">Property</th>
                <th className="py-3.5 font-semibold">Apartment</th>
                <th className="py-3.5 font-semibold">Cycle</th>
                <th className="py-3.5 font-semibold">Status</th>
                <th className="py-3.5 font-semibold">Tenant name</th>
                <th className="py-3.5 font-semibold">Rent</th>
                <th className="py-3.5 pr-6 font-semibold">Action</th>
              </tr>
            </thead>
            <tbody>
              {leased.map((a) => (
                <tr
                  key={`${a.building.id}-${a.id}`}
                  className="border-b border-azure-900/5 last:border-0 dark:border-white/5"
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3.5">
                      <Image
                        src={a.building.photo}
                        alt={a.building.name}
                        width={96}
                        height={96}
                        className="h-12 w-12 shrink-0 rounded-xl object-cover"
                      />
                      <div className="min-w-0">
                        <p className="whitespace-nowrap font-bold text-azure-950 dark:text-white">
                          {a.building.name}
                        </p>
                        <p className="whitespace-nowrap text-xs text-onyx/45 dark:text-white/45">
                          {a.building.address}, {a.building.city}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="py-4 pr-4 font-semibold text-azure-950 dark:text-white">{a.label}</td>
                  <td className="py-4 pr-4 capitalize text-onyx/60 dark:text-white/60">{a.cycle}</td>
                  <td className="py-4 pr-4">
                    <RentChip status={a.rentStatus} />
                  </td>
                  <td className="py-4 pr-4">
                    <div className="flex items-center gap-2.5">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-azure-800 text-[11px] font-bold text-soft-500">
                        {a.tenant!.name.split(" ").map((w) => w[0]).join("")}
                      </span>
                      <span className="whitespace-nowrap text-onyx/75 dark:text-white/75">
                        {a.tenant!.name}
                      </span>
                    </div>
                  </td>
                  <td className="py-4 pr-4 font-bold text-azure-950 dark:text-white">{fmt(a.rent)}</td>
                  <td className="py-4 pr-6">
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/dashboard/buildings/${a.building.id}/${a.id}`}
                        className="rounded-xl bg-onyx px-5 py-2 text-sm font-semibold text-white transition hover:bg-azure-900 dark:bg-white dark:text-onyx dark:hover:bg-soft-400"
                      >
                        View
                      </Link>
                      <button className="rounded-xl border border-azure-900/15 px-4 py-2 text-sm font-semibold text-azure-950 transition hover:bg-azure-900/5 dark:border-white/15 dark:text-white dark:hover:bg-white/10">
                        {a.rentStatus === "paid" ? "Receipt" : "Remind"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
