import Link from "next/link";
import { getBuilding, tickets } from "@/lib/data";
import {
  Card,
  CardTitle,
  PageTitle,
  StatCard,
  TicketChip,
  ViaBadge,
} from "@/components/dashboard/ui";

export default function MaintenancePage() {
  const open = tickets.filter((t) => t.status !== "resolved");
  const resolved = tickets.filter((t) => t.status === "resolved");
  const viaWhatsApp = tickets.filter((t) => t.reportedVia === "whatsapp").length;

  return (
    <>
      <PageTitle
        title="Maintenance"
        subtitle="Every request your tenants report, tracked from first message to confirmed fix."
        action={
          <button className="rounded-full bg-soft-500 px-6 py-3 text-sm font-semibold text-azure-950 transition hover:bg-soft-400">
            New ticket
          </button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard emphasis label="Open tickets" value={String(open.length)} hint="across all buildings" />
        <StatCard label="Resolved this month" value={String(resolved.length)} hint="average 4 days to fix" />
        <StatCard label="Reported over WhatsApp" value={`${Math.round((viaWhatsApp / tickets.length) * 100)}%`} hint="no app for tenants to install" />
        <StatCard label="Awaiting assignment" value={String(tickets.filter((t) => t.status === "new").length)} hint="needs a contractor" />
      </div>

      {/* open tickets */}
      <Card className="mt-6">
        <CardTitle>Open tickets</CardTitle>
        <div className="grid gap-4 lg:grid-cols-2">
          {open.map((t) => {
            const b = getBuilding(t.buildingId)!;
            return (
              <div key={t.id} className="rounded-2xl border border-white/10 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold text-white/40">{t.id}</p>
                    <p className="mt-0.5 font-bold text-white">{t.title}</p>
                  </div>
                  <TicketChip status={t.status} />
                </div>
                <p className="mt-2 text-sm text-white/55">
                  <Link href={`/dashboard/buildings/${b.id}`} className="transition hover:text-soft-500">
                    {b.name}
                  </Link>{" "}
                  · {t.apartment}
                </p>
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <ViaBadge via={t.reportedVia} />
                    <span className="text-xs text-white/45">
                      opened {t.openedOn} · {t.daysOpen} {t.daysOpen === 1 ? "day" : "days"} ago
                    </span>
                  </div>
                  {t.assignee ? (
                    <span className="text-xs font-semibold text-soft-500">{t.assignee}</span>
                  ) : (
                    <button className="rounded-full border border-white/15 px-3.5 py-1.5 text-xs font-semibold text-soft-500 transition hover:bg-white/10">
                      Assign
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* resolved */}
      <Card className="mt-6">
        <CardTitle>Recently resolved</CardTitle>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 text-xs uppercase tracking-wide text-white/40">
                <th className="pb-3 font-semibold">Ticket</th>
                <th className="pb-3 font-semibold">Location</th>
                <th className="pb-3 font-semibold">Handled by</th>
                <th className="pb-3 font-semibold">Time to fix</th>
                <th className="pb-3 text-right font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {resolved.map((t) => {
                const b = getBuilding(t.buildingId)!;
                return (
                  <tr key={t.id} className="border-b border-white/10 last:border-0">
                    <td className="py-3.5">
                      <p className="font-bold text-white">{t.title}</p>
                      <p className="text-xs text-white/40">{t.id}</p>
                    </td>
                    <td className="py-3.5 text-white/60">
                      {b.name} · {t.apartment}
                    </td>
                    <td className="py-3.5 text-white/60">{t.assignee}</td>
                    <td className="py-3.5 text-white/60">
                      {t.daysOpen} {t.daysOpen === 1 ? "day" : "days"}
                    </td>
                    <td className="py-3.5 text-right">
                      <TicketChip status={t.status} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
