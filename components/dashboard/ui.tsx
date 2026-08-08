import Link from "next/link";
import type { RentStatus, TicketStatus } from "@/lib/data";

export function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-3xl border border-white/8 bg-white/[0.04] p-6 ${className}`}>
      {children}
    </div>
  );
}

export function CardTitle({
  children,
  action,
}: {
  children: React.ReactNode;
  action?: { label: string; href: string };
}) {
  return (
    <div className="mb-5 flex items-center justify-between gap-4">
      <h2 className="text-[15px] font-bold text-white">{children}</h2>
      {action && (
        <Link
          href={action.href}
          className="text-sm font-semibold text-soft-500 transition hover:text-soft-400"
        >
          {action.label}
        </Link>
      )}
    </div>
  );
}

export function PageTitle({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-serif text-3xl font-medium tracking-tight text-white sm:text-4xl">
          {title}
        </h1>
        {subtitle && <p className="mt-1.5 text-[15px] text-white/45">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  emphasis = false,
}: {
  label: string;
  value: string;
  hint?: string;
  emphasis?: boolean;
}) {
  return (
    <div
      className={`rounded-3xl p-6 ${
        emphasis
          ? "bg-soft-500 text-azure-950 shadow-lg shadow-soft-500/10"
          : "border border-white/8 bg-white/[0.04]"
      }`}
    >
      <p className={`text-[13px] font-medium ${emphasis ? "text-azure-950/70" : "text-white/45"}`}>
        {label}
      </p>
      <p className={`mt-1.5 text-3xl font-extrabold tracking-tight ${emphasis ? "text-azure-950" : "text-white"}`}>
        {value}
      </p>
      {hint && (
        <p className={`mt-1 text-xs ${emphasis ? "text-azure-950/60" : "text-white/40"}`}>{hint}</p>
      )}
    </div>
  );
}

/* Status chips: soft blue for settled, glass for pending, white on onyx for alerts */

export function RentChip({ status }: { status: RentStatus }) {
  const styles: Record<RentStatus, [string, string]> = {
    paid: ["Paid", "bg-soft-500 text-azure-950"],
    pending: ["Pending", "border border-white/15 bg-white/5 text-white/75"],
    overdue: ["Overdue", "bg-white text-onyx"],
  };
  const [label, cls] = styles[status];
  return (
    <span className={`inline-block rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wide ${cls}`}>
      {label}
    </span>
  );
}

export function TicketChip({ status }: { status: TicketStatus }) {
  const styles: Record<TicketStatus, [string, string]> = {
    new: ["New", "bg-white text-onyx"],
    assigned: ["Assigned", "border border-white/15 bg-white/5 text-white/75"],
    "in-progress": ["In progress", "bg-soft-500 text-azure-950"],
    resolved: ["Resolved", "border border-white/10 bg-white/5 text-white/45"],
  };
  const [label, cls] = styles[status];
  return (
    <span className={`inline-block whitespace-nowrap rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wide ${cls}`}>
      {label}
    </span>
  );
}

export function ViaBadge({ via }: { via: "whatsapp" | "phone" | "email" }) {
  const label = via === "whatsapp" ? "WhatsApp" : via === "phone" ? "Phone" : "Email";
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 px-2.5 py-1 text-[11px] font-semibold text-white/55">
      <span className="h-1.5 w-1.5 rounded-full bg-soft-500" />
      {label}
    </span>
  );
}

export function ProgressBar({ pct, className = "" }: { pct: number; className?: string }) {
  return (
    <div className={`h-2.5 overflow-hidden rounded-full bg-white/10 ${className}`}>
      <div
        className="h-full rounded-full bg-soft-500 transition-all"
        style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
      />
    </div>
  );
}

/* Placeholder visual for a building, monogram tile in brand tones */
export function BuildingTile({
  name,
  className = "h-14 w-14 text-xl",
}: {
  name: string;
  className?: string;
}) {
  const initials = name
    .split(" ")
    .filter((w) => w[0] === w[0]?.toUpperCase())
    .slice(0, 2)
    .map((w) => w[0])
    .join("");
  return (
    <span
      className={`grid shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-azure-700 to-azure-900 font-serif font-medium text-soft-500 ${className}`}
    >
      {initials}
    </span>
  );
}
