"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "./ThemeToggle";

const NAV = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" />
        <rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" />
      </svg>
    ),
  },
  {
    label: "Buildings",
    href: "/dashboard/buildings",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 21h18M5 21V5a1 1 0 011-1h7a1 1 0 011 1v16M14 9h4a1 1 0 011 1v11M8 8h2M8 12h2M8 16h2" />
      </svg>
    ),
  },
  {
    label: "Rent collection",
    href: "/dashboard/rent",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="6" width="20" height="12" rx="2" /><circle cx="12" cy="12" r="2.5" /><path d="M6 12h.01M18 12h.01" />
      </svg>
    ),
  },
  {
    label: "Maintenance",
    href: "/dashboard/maintenance",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14.7 6.3a4.5 4.5 0 00-6 6L3 18l3 3 5.7-5.7a4.5 4.5 0 006-6L15 12l-3-3 2.7-2.7z" />
      </svg>
    ),
  },
  {
    label: "Settings",
    href: "/dashboard/settings",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.7 1.7 0 00.3 1.9l.1.1a2 2 0 11-2.9 2.9l-.1-.1a1.7 1.7 0 00-1.9-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1-1.6 1.7 1.7 0 00-1.9.3l-.1.1a2 2 0 11-2.9-2.9l.1-.1a1.7 1.7 0 00.3-1.9 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.6-1 1.7 1.7 0 00-.3-1.9l-.1-.1a2 2 0 112.9-2.9l.1.1a1.7 1.7 0 001.9.3h0a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5h0a1.7 1.7 0 001.9-.3l.1-.1a2 2 0 112.9 2.9l-.1.1a1.7 1.7 0 00-.3 1.9v0a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z" />
      </svg>
    ),
  },
];

function isActive(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname.startsWith(href);
}

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="relative flex min-h-screen bg-gradient-to-br from-soft-100 via-white to-soft-200 text-azure-950 dark:from-onyx dark:via-onyx dark:to-azure-950 dark:text-white">
      {/* ambient color for the glass to blur */}
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute -top-32 left-[15%] h-[32rem] w-[32rem] rounded-full bg-soft-500/60 blur-3xl dark:bg-azure-600/25" />
        <div className="absolute -right-24 top-1/4 h-[28rem] w-[28rem] rounded-full bg-azure-600/30 blur-3xl dark:bg-soft-500/12" />
        <div className="absolute -left-32 top-1/2 h-[30rem] w-[30rem] rounded-full bg-azure-700/25 blur-3xl dark:bg-azure-700/30" />
        <div className="absolute bottom-0 left-1/3 h-[26rem] w-[26rem] rounded-full bg-soft-400/45 blur-3xl dark:bg-azure-600/15" />
      </div>
      {/* sidebar, transparent liquid glass */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-white/60 bg-white/35 shadow-xl shadow-azure-900/5 backdrop-blur-2xl lg:flex dark:border-white/10 dark:bg-white/[0.05] dark:shadow-none">
        <div className="relative px-6 py-7">
          <span className="dark:hidden">
            <Logo textClassName="text-xl" markClassName="h-9 w-9" />
          </span>
          <span className="hidden dark:block">
            <Logo dark textClassName="text-xl" markClassName="h-9 w-9" />
          </span>
        </div>
        <nav className="relative flex-1 space-y-1 px-4">
          {NAV.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-[15px] font-medium transition ${
                  active
                    ? "bg-soft-500 text-azure-950 shadow-sm shadow-azure-800/10"
                    : "text-onyx/60 hover:bg-azure-900/5 hover:text-azure-950 dark:text-white/55 dark:hover:bg-white/5 dark:hover:text-white"
                }`}
              >
                {item.icon}
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="relative m-4 rounded-2xl border border-white/70 bg-white/45 p-4 backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
          <p className="text-sm font-semibold text-azure-800 dark:text-soft-500">Growth plan</p>
          <p className="mt-1 text-xs leading-relaxed text-onyx/55 dark:text-white/50">
            Trial ends in 21 days. Your data stays yours.
          </p>
          <Link
            href="/dashboard/settings"
            className="mt-3 block rounded-full bg-onyx py-2 text-center text-xs font-bold text-white transition hover:bg-azure-900 dark:bg-soft-500 dark:text-azure-950 dark:hover:bg-soft-400"
          >
            Manage plan
          </Link>
        </div>
        <div className="relative border-t border-azure-900/10 px-6 py-4 dark:border-white/10">
          <Link href="/" className="text-xs text-onyx/40 transition hover:text-azure-800 dark:text-white/40 dark:hover:text-white/80">
            Back to chartahome.com
          </Link>
        </div>
      </aside>

      {/* main column */}
      <div className="relative z-10 flex min-w-0 flex-1 flex-col lg:pl-64">
        {/* topbar */}
        <header className="sticky top-0 z-30 border-b border-white/60 bg-white/40 backdrop-blur-2xl dark:border-white/5 dark:bg-white/[0.03]">
          <div className="flex h-16 items-center justify-between gap-4 px-5 sm:px-8">
            <div className="lg:hidden">
              <span className="dark:hidden">
                <Logo textClassName="text-lg" markClassName="h-8 w-8" />
              </span>
              <span className="hidden dark:block">
                <Logo dark textClassName="text-lg" markClassName="h-8 w-8" />
              </span>
            </div>
            <div className="hidden max-w-md flex-1 items-center gap-2.5 rounded-full border border-white/70 bg-white/50 px-4 py-2 backdrop-blur-xl md:flex dark:border-white/10 dark:bg-white/5">
              <svg viewBox="0 0 24 24" className="h-4 w-4 text-onyx/35 dark:text-white/35" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" />
              </svg>
              <input
                placeholder="Search buildings, tenants, tickets…"
                className="w-full bg-transparent text-sm text-azure-950 outline-none placeholder:text-onyx/30 dark:text-white dark:placeholder:text-white/30"
              />
            </div>
            <div className="flex items-center gap-3">
              <ThemeToggle />
              <button
                aria-label="Notifications"
                className="relative grid h-10 w-10 place-items-center rounded-full border border-azure-900/10 text-azure-800 transition hover:bg-azure-900/5 dark:border-white/10 dark:text-white/70 dark:hover:bg-white/5"
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 01-3.4 0" />
                </svg>
                <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-azure-600 dark:bg-soft-500" />
              </button>
              <div className="flex items-center gap-2.5">
                <span className="grid h-10 w-10 place-items-center rounded-full bg-azure-800 text-sm font-bold text-soft-500 dark:bg-soft-500 dark:text-azure-950">
                  AS
                </span>
                <div className="hidden sm:block">
                  <p className="text-sm font-semibold leading-tight text-azure-950 dark:text-white">Amina Sow</p>
                  <p className="text-xs leading-tight text-onyx/45 dark:text-white/40">Horizon Realty</p>
                </div>
              </div>
            </div>
          </div>

          {/* mobile nav */}
          <nav className="flex gap-1 overflow-x-auto px-3 pb-2 lg:hidden">
            {NAV.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-medium ${
                    active
                      ? "bg-azure-800 text-white dark:bg-soft-500 dark:text-azure-950"
                      : "text-onyx/55 hover:bg-azure-900/5 dark:text-white/55 dark:hover:bg-white/5"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </header>

        <main className="relative z-10 flex-1 px-5 py-8 sm:px-8">{children}</main>
      </div>
    </div>
  );
}
