"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Logo } from "./Logo";

const links = [
  { label: "Features", href: "/features" },
  { label: "Pricing", href: "/pricing" },
  { label: "FAQ", href: "/pricing#faq" },
  { label: "Contact", href: "/contact" },
];

export function Navbar({ transparent = false }: { transparent?: boolean }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <header
      className={
        transparent
          ? "absolute inset-x-0 top-0 z-50 bg-transparent"
          : "sticky top-0 z-50 border-b border-azure-800/5 bg-white/80 backdrop-blur-md"
      }
    >
      <nav className="mx-auto flex h-[72px] max-w-7xl items-center justify-between px-5 sm:px-8">
        <Logo />

        <div className="hidden items-center gap-8 md:flex">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`text-[15px] font-medium transition hover:text-azure-800 ${
                pathname === l.href
                  ? "text-azure-800 underline decoration-soft-500 decoration-2 underline-offset-8"
                  : "text-onyx/70"
              }`}
            >
              {l.label}
            </Link>
          ))}
        </div>

        <div className="hidden items-center gap-3 md:flex">
          <Link
            href="/login"
            className="rounded-full px-4 py-2 text-[15px] font-medium text-azure-800 transition hover:bg-soft-100"
          >
            Log in
          </Link>
          <Link
            href="/signup"
            className="group flex items-center gap-2 rounded-full bg-onyx py-2.5 pl-5 pr-4 text-[15px] font-semibold text-white shadow-lg shadow-onyx/20 transition hover:bg-azure-900"
          >
            Get Started
            <span className="grid h-5 w-5 place-items-center rounded-full bg-white/15 text-xs transition group-hover:bg-white/25">
              +
            </span>
          </Link>
        </div>

        <button
          className="grid h-10 w-10 place-items-center rounded-full text-azure-800 md:hidden"
          onClick={() => setOpen(!open)}
          aria-label="Toggle menu"
        >
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
          </svg>
        </button>
      </nav>

      {open && (
        <div className="border-t border-azure-800/5 bg-white px-5 py-4 md:hidden">
          <div className="flex flex-col gap-1">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className={`rounded-xl px-3 py-2.5 font-medium hover:bg-soft-100 ${
                  pathname === l.href ? "bg-soft-100 text-azure-800" : "text-onyx/70"
                }`}
              >
                {l.label}
              </Link>
            ))}
            <div className="mt-2 flex gap-3">
              <Link
                href="/login"
                className="flex-1 rounded-full border border-azure-800/15 py-2.5 text-center font-medium text-azure-800"
              >
                Log in
              </Link>
              <Link
                href="/signup"
                className="flex-1 rounded-full bg-onyx py-2.5 text-center font-semibold text-white"
              >
                Get Started
              </Link>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
