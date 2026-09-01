"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { Logo, LogoMark } from "@/components/Logo";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { ThemeToggle } from "./ThemeToggle";
import { BuildingSwitcher } from "./BuildingSwitcher";
import { Toasts } from "./Toasts";
import { BuildingProvider } from "@/lib/building-context";
import { StoreProvider, useStore, type StoreSeed } from "@/lib/store";
import { FirstBuilding } from "./FirstBuilding";
import { useI18n } from "@/lib/i18n/context";
import { signOut } from "@/lib/supabase/auth-actions";

const ICONS = {
  dashboard: (
    <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" />
      <rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" />
    </svg>
  ),
  buildings: (
    <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 21h18M5 21V5a1 1 0 011-1h7a1 1 0 011 1v16M14 9h4a1 1 0 011 1v11M8 8h2M8 12h2M8 16h2" />
    </svg>
  ),
  rent: (
    <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="6" width="20" height="12" rx="2" /><circle cx="12" cy="12" r="2.5" /><path d="M6 12h.01M18 12h.01" />
    </svg>
  ),
  maintenance: (
    <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.7 6.3a4.5 4.5 0 00-6 6L3 18l3 3 5.7-5.7a4.5 4.5 0 006-6L15 12l-3-3 2.7-2.7z" />
    </svg>
  ),
  tenants: (
    <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
    </svg>
  ),
  settings: (
    <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 00.3 1.9l.1.1a2 2 0 11-2.9 2.9l-.1-.1a1.7 1.7 0 00-1.9-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1-1.6 1.7 1.7 0 00-1.9.3l-.1.1a2 2 0 11-2.9-2.9l.1-.1a1.7 1.7 0 00.3-1.9 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.6-1 1.7 1.7 0 00-.3-1.9l-.1-.1a2 2 0 112.9-2.9l.1.1a1.7 1.7 0 001.9.3h0a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5h0a1.7 1.7 0 001.9-.3l.1-.1a2 2 0 112.9 2.9l-.1.1a1.7 1.7 0 00-.3 1.9v0a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z" />
    </svg>
  ),
};

function DashboardChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { t, path, locale } = useI18n();
  const [collapsed, setCollapsed] = useState(false);
  const { buildings, currentUser } = useStore();
  const hasBuildings = buildings.length > 0;

  // Initials from whatever name is on the membership. One word gives one
  // letter rather than an awkward doubled one.
  const initials =
    (currentUser?.name ?? "")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "?";

  // What this colleague may open. The middleware checks the same list, so a
  // hidden link is a closed route rather than a link somebody could guess.
  const mayOpen = (href: string) => {
    const pages = currentUser?.allowedPages;
    if (!pages) return true;
    const section = href.replace("/dashboard", "").replace(/^\//, "").split("/")[0];
    // Settings is never gated: it holds the person's own name, and its agency
    // fields are owner only already.
    if (section === "" ) return pages.includes("dashboard");
    if (section === "settings") return true;
    return pages.includes(section);
  };

  const groups = [
    {
      label: t.dash.groups.main,
      items: [{ label: t.dash.nav.dashboard, href: "/dashboard", icon: ICONS.dashboard }],
    },
    {
      label: t.dash.groups.portfolio,
      items: [{ label: t.dash.nav.apartments, href: "/dashboard/apartments", icon: ICONS.buildings }],
    },
    {
      label: t.dash.groups.operations,
      items: [
        { label: t.dash.nav.rent, href: "/dashboard/rent", icon: ICONS.rent },
        { label: t.dash.nav.maintenance, href: "/dashboard/maintenance", icon: ICONS.maintenance },
      ],
    },
    {
      label: t.dash.groups.system,
      items: [{ label: t.dash.nav.settings, href: "/dashboard/settings", icon: ICONS.settings }],
    },
  ]
    .map((group) => ({ ...group, items: group.items.filter((i) => mayOpen(i.href)) }))
    .filter((group) => group.items.length > 0);
  const flatNav = groups.flatMap((g) => g.items);

  const isSettings = pathname.startsWith(`/${locale}/dashboard/settings`);

  const isActive = (href: string) => {
    const base = pathname.replace(new RegExp(`^/${locale}`), "") || "/";
    if (href === "/dashboard") return base === "/dashboard";
    return base.startsWith(href);
  };

  const logout = async () => {
    try {
      localStorage.removeItem("charta-session");
    } catch {
      /* ignore */
    }
    // Ends the Supabase session and redirects. Without a project configured it
    // returns, and the push below takes over.
    await signOut(locale);
    router.push(path("/login"));
  };

  return (
    <div className="relative flex min-h-screen bg-gradient-to-br from-white via-white to-soft-100/50 text-azure-950 dark:from-onyx dark:via-onyx dark:to-azure-950 dark:text-white">
      {/* Ambient colour for the glass to blur. Faint on purpose in daylight:
          the glass needs something behind it to pick up, but anything stronger
          reads as a blue page rather than a white one. */}
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute -top-32 left-[15%] h-[32rem] w-[32rem] rounded-full bg-soft-500/20 blur-3xl dark:bg-azure-600/25" />
        <div className="absolute -right-24 top-1/4 h-[28rem] w-[28rem] rounded-full bg-azure-600/10 blur-3xl dark:bg-soft-500/12" />
        <div className="absolute -left-32 top-1/2 h-[30rem] w-[30rem] rounded-full bg-azure-700/8 blur-3xl dark:bg-azure-700/30" />
        <div className="absolute bottom-0 left-1/3 h-[26rem] w-[26rem] rounded-full bg-soft-400/15 blur-3xl dark:bg-azure-600/15" />
      </div>

      {/* floating glass sidebar */}
      <aside
        className={`fixed inset-y-4 left-4 z-40 hidden flex-col rounded-[1.75rem] border border-white/70 bg-white/55 shadow-xl shadow-azure-900/10 backdrop-blur-2xl transition-[width] duration-300 lg:flex dark:border-white/10 dark:bg-white/[0.05] dark:shadow-none ${
          collapsed ? "w-[5.5rem]" : "w-64"
        }`}
      >
        <div className={`flex items-center gap-2 px-5 pb-2 pt-6 ${collapsed ? "justify-center px-3" : "justify-between"}`}>
          {collapsed ? (
            <Link href={path("/dashboard")} aria-label="Charta Home">
              <LogoMark className="h-9 w-9" />
            </Link>
          ) : (
            <>
              <span className="dark:hidden">
                <Logo href={path("/dashboard")} textClassName="text-xl" markClassName="h-9 w-9" />
              </span>
              <span className="hidden dark:block">
                <Logo dark href={path("/dashboard")} textClassName="text-xl" markClassName="h-9 w-9" />
              </span>
            </>
          )}
          {!collapsed && (
            <button
              onClick={() => setCollapsed(true)}
              aria-label={t.dash.shell.collapse}
              className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-onyx/40 transition hover:bg-azure-900/5 hover:text-azure-950 dark:text-white/40 dark:hover:bg-white/10 dark:hover:text-white"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="16" rx="2.5" /><path d="M10 4v16" />
              </svg>
            </button>
          )}
        </div>

        {/* No agency name here. The sidebar is for moving around, and the
            agency is on the settings page where it can be read and changed
            together with its currency, its team and the buildings under it. */}

        {collapsed && (
          <button
            onClick={() => setCollapsed(false)}
            aria-label={t.dash.shell.expand}
            className="mx-auto mt-1 grid h-8 w-8 place-items-center rounded-lg text-onyx/40 transition hover:bg-azure-900/5 hover:text-azure-950 dark:text-white/40 dark:hover:bg-white/10 dark:hover:text-white"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="16" rx="2.5" /><path d="M14 4v16" />
            </svg>
          </button>
        )}

        <nav className="flex-1 overflow-y-auto px-3 pb-2">
          {groups.map((group) => (
            <div key={group.label}>
              {collapsed ? (
                <div className="my-3 h-px bg-azure-900/8 dark:bg-white/10" />
              ) : (
                <p className="px-3 pb-1.5 pt-5 text-[13px] font-medium text-onyx/35 dark:text-white/30">
                  {group.label}
                </p>
              )}
              <div className="space-y-1">
                {group.items.map((item) => {
                  const active = isActive(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={path(item.href)}
                      title={collapsed ? item.label : undefined}
                      className={`flex items-center gap-3 rounded-2xl text-[15px] font-medium transition ${
                        collapsed ? "justify-center px-3 py-3" : "px-4 py-3"
                      } ${
                        active
                          ? "bg-onyx text-white shadow-lg shadow-onyx/20 dark:bg-soft-500 dark:text-azure-950 dark:shadow-none"
                          : "text-onyx/65 hover:bg-azure-900/5 hover:text-azure-950 dark:text-white/55 dark:hover:bg-white/5 dark:hover:text-white"
                      }`}
                    >
                      {item.icon}
                      {!collapsed && <span className="truncate">{item.label}</span>}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {!collapsed && (
          <div className="relative m-4 rounded-2xl border border-white/70 bg-white/45 p-4 backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
            <p className="text-sm font-semibold text-azure-800 dark:text-soft-500">
              {t.dash.shell.growthPlan}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-onyx/55 dark:text-white/50">
              {t.dash.shell.trialEnds}
            </p>
            <Link
              href={path("/dashboard/settings")}
              className="mt-3 block rounded-full bg-onyx py-2 text-center text-xs font-bold text-white transition hover:bg-azure-900 dark:bg-soft-500 dark:text-azure-950 dark:hover:bg-soft-400"
            >
              {t.dash.shell.managePlan}
            </Link>
          </div>
        )}

        <div className={`m-3 flex items-center gap-2 ${collapsed ? "flex-col" : ""}`}>
          <Link
            href={path("/dashboard/settings")}
            className={`flex flex-1 items-center rounded-2xl border border-white/70 bg-white/60 backdrop-blur-xl transition hover:bg-white/80 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10 ${
              collapsed ? "justify-center p-2" : "gap-3 p-3"
            }`}
          >
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-azure-800 text-sm font-bold text-soft-500">
              {initials}
            </span>
            {!collapsed && (
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold text-azure-950 dark:text-white">
                  {currentUser?.name || t.dash.shell.yourAccount}
                </span>
                <span className="block text-xs text-onyx/45 dark:text-white/40">
                  {currentUser ? t.dash.settings.inviteModal.roles[currentUser.role] : t.dash.shell.admin}
                </span>
              </span>
            )}
          </Link>
          <button
            onClick={logout}
            aria-label={t.dash.shell.logout}
            title={t.dash.shell.logout}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-onyx/40 transition hover:bg-azure-900/5 hover:text-azure-950 dark:text-white/40 dark:hover:bg-white/10 dark:hover:text-white"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" />
            </svg>
          </button>
        </div>
      </aside>

      {/* main column */}
      <div
        className={`relative z-10 flex min-w-0 flex-1 flex-col transition-[padding] duration-300 ${
          collapsed ? "lg:pl-[7.5rem]" : "lg:pl-[18rem]"
        }`}
      >
        {/*
          The bar floats as a rounded card rather than spanning edge to edge.
          The sticky wrapper keeps its own blur so the strip of page showing
          through the inset stays legible as the content scrolls under it.
        */}
        <header className="sticky top-0 z-30 px-3 pb-2 pt-3 backdrop-blur-2xl sm:px-5">
          {/* No overflow-hidden here. The rounded corners clip the card's own
              background without it, and with it the building switcher's menu
              was cut off at the card's edge: the panel opens below the bar, so
              every row of it fell outside and the dropdown looked empty. */}
          <div className="rounded-3xl border border-white/60 bg-white/50 shadow-sm backdrop-blur-2xl dark:border-white/10 dark:bg-white/[0.04]">
          <div className="flex h-16 items-center justify-between gap-4 px-5 sm:px-8">
            <div className="lg:hidden">
              <span className="dark:hidden">
                <Logo href={path("/dashboard")} textClassName="text-lg" markClassName="h-8 w-8" />
              </span>
              <span className="hidden dark:block">
                <Logo dark href={path("/dashboard")} textClassName="text-lg" markClassName="h-8 w-8" />
              </span>
            </div>
            <div className="flex min-w-0 flex-1 items-center">
              <div className="hidden max-w-md flex-1 items-center gap-2.5 rounded-full border border-white/70 bg-white/50 px-4 py-2 backdrop-blur-xl md:flex dark:border-white/10 dark:bg-white/5">
                <svg viewBox="0 0 24 24" className="h-4 w-4 text-onyx/35 dark:text-white/35" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" />
                </svg>
                <input
                  placeholder={t.dash.shell.search}
                  className="w-full bg-transparent text-sm text-azure-950 outline-none placeholder:text-onyx/30 dark:text-white dark:placeholder:text-white/30"
                />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <LanguageSwitcher tone="dashboard" />
              <ThemeToggle />
              {/* One chip, and it changes the building. An agency chip beside
                  it read as a second building selector, which is a bad way to
                  find out you are looking at a different portfolio. */}
              <BuildingSwitcher align="right" />
            </div>
          </div>

          {/* mobile nav */}
          <nav className="flex gap-1 overflow-x-auto px-3 pb-2 lg:hidden">
            {flatNav.map((item) => {
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={path(item.href)}
                  className={`whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-medium ${
                    active
                      ? "bg-onyx text-white dark:bg-soft-500 dark:text-azure-950"
                      : "text-onyx/55 hover:bg-azure-900/5 dark:text-white/55 dark:hover:bg-white/5"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
          </div>
        </header>

        <main className="relative z-10 flex-1 px-5 py-8 sm:px-8">
          {/* An agency with no buildings gets the prompt to add one, because
              apartments, leases and tickets all hang off a building. Settings
              is the exception: a new agency needs its name, its currency and
              its team set, and standing in front of that until a building
              exists means an agency that bills in the wrong currency from its
              first day. */}
          {hasBuildings || isSettings ? children : <FirstBuilding />}
        </main>
      </div>

      <Toasts />
    </div>
  );
}

export function Shell({
  children,
  seed,
}: {
  children: React.ReactNode;
  /** The agency's portfolio, or null when there is none to load. */
  seed: StoreSeed | null;
}) {
  // No agency behind the session. The middleware already turns away anyone
  // signed out, so this is the rarer case of a project that is unreachable or
  // an account with no membership; either way there is nothing to render.
  if (!seed) return <NoAgency />;

  return (
    <StoreProvider seed={seed}>
      <BuildingProvider>
        <DashboardChrome>{children}</DashboardChrome>
      </BuildingProvider>
    </StoreProvider>
  );
}

function NoAgency() {
  const { t, path } = useI18n();
  return (
    <div className="grid min-h-screen place-items-center bg-gradient-to-br from-soft-100 via-white to-soft-200 px-6 dark:from-onyx dark:via-onyx dark:to-azure-950">
      <div className="max-w-md text-center">
        <LogoMark className="mx-auto h-12 w-12" />
        <h1 className="mt-6 font-serif text-2xl font-medium text-azure-950 dark:text-white">
          {t.dash.noAgency.title}
        </h1>
        <p className="mt-2 text-sm text-onyx/55 dark:text-white/50">
          {t.dash.noAgency.body}
        </p>
        <Link
          href={path("/login")}
          className="mt-6 inline-block rounded-full bg-onyx px-6 py-3 text-sm font-semibold text-white transition hover:bg-azure-900 dark:bg-soft-500 dark:text-azure-950"
        >
          {t.dash.noAgency.action}
        </Link>
      </div>
    </div>
  );
}
