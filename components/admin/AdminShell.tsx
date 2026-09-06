"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Logo } from "@/components/Logo";
import { useI18n } from "@/lib/i18n/context";
import { signOut } from "@/lib/supabase/auth-actions";

export type AdminIdentity = { email: string; hasAgency: boolean };

/**
 * The frame both desk pages share: the brand, the two tabs, who is sitting
 * here, and the way out. The link back to a dashboard is offered only to
 * staff who also belong to an agency, because most do not.
 */
export function AdminShell({
  me,
  tab,
  title,
  subtitle,
  children,
}: {
  me: AdminIdentity;
  tab: "agencies" | "subscriptions";
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  const { t, path, locale } = useI18n();
  const a = t.admin;
  const router = useRouter();

  const tabs: { key: "agencies" | "subscriptions"; label: string; href: string }[] = [
    { key: "agencies", label: a.tabs.agencies, href: path("/admin") },
    { key: "subscriptions", label: a.tabs.subscriptions, href: path("/admin/subscriptions") },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-white to-soft-100/50 text-azure-950 dark:from-onyx dark:via-onyx dark:to-azure-950 dark:text-white">
      <header className="flex flex-wrap items-center justify-between gap-4 px-4 pt-5 sm:px-6">
        <div className="flex items-center gap-6">
          <span className="dark:hidden"><Logo href={path("/admin")} textClassName="text-lg" markClassName="h-8 w-8" /></span>
          <span className="hidden dark:block"><Logo dark href={path("/admin")} textClassName="text-lg" markClassName="h-8 w-8" /></span>
          <nav className="flex gap-1 rounded-full border border-azure-900/10 bg-white/80 p-1 backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.05]">
            {tabs.map((x) => (
              <Link
                key={x.key}
                href={x.href}
                aria-current={x.key === tab ? "page" : undefined}
                className={`rounded-full px-4 py-1.5 text-xs font-bold transition ${
                  x.key === tab
                    ? "bg-onyx text-white dark:bg-soft-500 dark:text-azure-950"
                    : "text-onyx/60 hover:text-azure-950 dark:text-white/55 dark:hover:text-white"
                }`}
              >
                {x.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden text-right sm:block">
            <span className="block text-sm font-semibold">{me.email}</span>
            <span className="block text-[11px] font-bold uppercase tracking-wider text-azure-800 dark:text-soft-500">{a.role}</span>
          </span>
          {me.hasAgency && (
            <Link href={path("/dashboard")} className="rounded-full border border-azure-900/15 px-4 py-2 text-xs font-bold text-azure-900 transition hover:bg-azure-900/5 dark:border-white/15 dark:text-white dark:hover:bg-white/10">
              {t.dash.nav.dashboard}
            </Link>
          )}
          <button
            type="button"
            onClick={async () => { await signOut(locale); router.push(path("/login")); }}
            className="rounded-full bg-onyx px-4 py-2 text-xs font-bold text-white transition hover:bg-azure-900 dark:bg-soft-500 dark:text-azure-950 dark:hover:bg-soft-400"
          >
            {a.signOut}
          </button>
        </div>
      </header>

      <main className="px-4 py-8 sm:px-6">
        <h1 className="font-serif text-3xl font-medium tracking-tight sm:text-4xl">{title}</h1>
        <p className="mt-1.5 text-[15px] text-onyx/50 dark:text-white/45">{subtitle}</p>
        {children}
      </main>
    </div>
  );
}

/** One glass tile. */
export function Tile({ label, value, foot, aside }: { label: string; value: string; foot?: string; aside?: React.ReactNode }) {
  return (
    <div className="rounded-3xl border border-azure-900/10 bg-white/80 p-5 shadow-lg shadow-azure-900/10 backdrop-blur-2xl dark:border-white/10 dark:bg-white/[0.05] dark:shadow-none">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-onyx/40 dark:text-white/35">{label}</p>
        {aside}
      </div>
      <p className="mt-1.5 text-xl font-bold">{value}</p>
      {foot && <p className="mt-1 text-[11px] text-onyx/45 dark:text-white/40">{foot}</p>}
    </div>
  );
}
