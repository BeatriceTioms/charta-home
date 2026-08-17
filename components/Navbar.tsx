"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Logo } from "./Logo";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { useI18n } from "@/lib/i18n/context";

function isActive(pathname: string, locale: string, path: string) {
  const base = pathname.replace(new RegExp(`^/${locale}`), "") || "/";
  if (path === "/") return base === "/";
  return base.startsWith(path);
}

export function Navbar({ transparent = false }: { transparent?: boolean }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const { t, locale, path } = useI18n();

  const links = [
    { label: t.nav.home, href: "/" },
    { label: t.nav.features, href: "/features" },
    { label: t.nav.pricing, href: "/pricing" },
    { label: t.nav.contact, href: "/contact" },
  ];

  return (
    <header
      className={
        transparent
          ? "absolute inset-x-0 top-0 z-50 bg-transparent"
          : "sticky top-0 z-50 border-b border-azure-800/5 bg-white/80 backdrop-blur-md"
      }
    >
      <nav className="mx-auto flex h-[76px] max-w-7xl items-center justify-between gap-4 px-5 sm:px-8">
        <Logo href={path("/")} />

        {/* capsule menu */}
        <div
          className={`hidden items-center rounded-full p-1.5 lg:flex ${
            transparent
              ? "bg-white/60 shadow-sm shadow-azure-800/5 backdrop-blur-md"
              : "bg-azure-900/5"
          }`}
        >
          {links.map((l) => {
            const active = isActive(pathname, locale, l.href);
            return (
              <Link
                key={l.href}
                href={path(l.href)}
                className={`rounded-full px-5 py-2 text-[15px] transition ${
                  active
                    ? "bg-white font-semibold text-azure-950 shadow-sm shadow-azure-800/10"
                    : "font-medium text-onyx/55 hover:text-azure-950"
                }`}
              >
                {l.label}
              </Link>
            );
          })}
        </div>

        <div className="hidden items-center gap-3 lg:flex">
          <LanguageSwitcher />
          <Link
            href={path("/login")}
            className="rounded-full px-4 py-2 text-[15px] font-medium text-azure-800 transition hover:bg-soft-100"
          >
            {t.nav.login}
          </Link>
          <Link
            href={path("/signup")}
            className="rounded-full bg-onyx px-6 py-3 text-[15px] font-semibold text-white shadow-lg shadow-onyx/20 transition hover:bg-azure-900"
          >
            {t.nav.getStarted}
          </Link>
        </div>

        <div className="flex items-center gap-2 lg:hidden">
          <LanguageSwitcher />
          <button
            className="grid h-10 w-10 place-items-center rounded-full text-azure-800"
            onClick={() => setOpen(!open)}
            aria-label={t.nav.toggleMenu}
            aria-expanded={open}
          >
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
            </svg>
          </button>
        </div>
      </nav>

      {open && (
        <div className="border-t border-azure-800/5 bg-white px-5 py-4 lg:hidden">
          <div className="flex flex-col gap-1">
            {links.map((l) => (
              <Link
                key={l.href}
                href={path(l.href)}
                onClick={() => setOpen(false)}
                className={`rounded-xl px-3 py-2.5 font-medium hover:bg-soft-100 ${
                  isActive(pathname, locale, l.href)
                    ? "bg-soft-100 text-azure-800"
                    : "text-onyx/70"
                }`}
              >
                {l.label}
              </Link>
            ))}
            <div className="mt-2 flex gap-3">
              <Link
                href={path("/login")}
                onClick={() => setOpen(false)}
                className="flex-1 rounded-full border border-azure-800/15 py-2.5 text-center font-medium text-azure-800"
              >
                {t.nav.login}
              </Link>
              <Link
                href={path("/signup")}
                onClick={() => setOpen(false)}
                className="flex-1 rounded-full bg-onyx py-2.5 text-center font-semibold text-white"
              >
                {t.nav.getStarted}
              </Link>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
