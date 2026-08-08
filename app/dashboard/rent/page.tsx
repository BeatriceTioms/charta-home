import Link from "next/link";
import { allApartments, collections, fmt } from "@/lib/data";
import {
  Card,
  CardTitle,
  PageTitle,
  ProgressBar,
  RentChip,
  StatCard,
} from "@/components/dashboard/ui";

export default function RentPage() {
  const leased = allApartments().filter((a) => a.tenant);
  const august = collections[collections.length - 1];
  const pct = Math.round((august.collected / august.due) * 100);
  const overdue = leased.filter((a) => a.rentStatus === "overdue");
  const pending = leased.filter((a) => a.rentStatus === "pending");

  return (
    <>
      <PageTitle
        title="Rent collection"
        subtitle="August 2026. Reminders are handled for you; step in only where needed."
        action={
          <button className="rounded-full bg-soft-500 px-6 py-3 text-sm font-semibold text-azure-950 transition hover:bg-soft-400">
            Record a payment
          </button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard emphasis label="Collected so far" value={fmt(august.collected)} hint={`${pct}% of ${fmt(august.due)}`} />
        <StatCard label="Awaiting payment" value={String(pending.length)} hint="reminders scheduled" />
        <StatCard label="Overdue" value={String(overdue.length)} hint="follow-up in progress" />
        <StatCard label="On-time rate, 6 months" value="94%" hint="across the portfolio" />
      </div>

      <Card className="mt-6">
        <CardTitle>Collection progress, August</CardTitle>
        <ProgressBar pct={pct} />
        <div className="mt-2.5 flex justify-between text-xs text-white/45">
          <span>{fmt(august.collected)} collected</span>
          <span>{fmt(august.due - august.collected)} outstanding</span>
        </div>
      </Card>

      <Card className="mt-6">
        <CardTitle>All leases</CardTitle>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 text-xs uppercase tracking-wide text-white/40">
                <th className="pb-3 font-semibold">Tenant</th>
                <th className="pb-3 font-semibold">Apartment</th>
                <th className="pb-3 font-semibold">Rent</th>
                <th className="pb-3 font-semibold">Due date</th>
                <th className="pb-3 font-semibold">Reminders</th>
                <th className="pb-3 text-right font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {leased.map((a) => (
                <tr key={`${a.building.id}-${a.id}`} className="border-b border-white/10 last:border-0">
                  <td className="py-3.5">
                    <p className="font-bold text-white">{a.tenant!.name}</p>
                    <p className="text-xs text-white/40">{a.tenant!.phone}</p>
                  </td>
                  <td className="py-3.5">
                    <Link
                      href={`/dashboard/buildings/${a.building.id}/${a.id}`}
                      className="text-white/70 transition hover:text-soft-500"
                    >
                      {a.label} · {a.building.name}
                    </Link>
                  </td>
                  <td className="py-3.5 font-semibold text-white">{fmt(a.rent)}</td>
                  <td className="py-3.5 text-white/60">1 Aug</td>
                  <td className="py-3.5 text-xs text-white/55">
                    {a.rentStatus === "paid" && "Courtesy reminder, 27 Jul"}
                    {a.rentStatus === "pending" && "Reminder sent 27 Jul · next 10 Aug"}
                    {a.rentStatus === "overdue" && "3 sent · escalation 12 Aug"}
                  </td>
                  <td className="py-3.5 text-right">
                    <div className="flex items-center justify-end gap-3">
                      <RentChip status={a.rentStatus} />
                      {a.rentStatus !== "paid" && (
                        <button className="rounded-full border border-white/15 px-3.5 py-1.5 text-xs font-semibold text-soft-500 transition hover:bg-white/10">
                          Remind now
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
