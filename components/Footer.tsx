"use client";

import Link from "next/link";
import { Logo } from "./Logo";
import { useI18n } from "@/lib/i18n/context";

export function Footer() {
  const { t, path } = useI18n();

  const columns = [
    {
      title: t.footer.product,
      links: [
        { label: t.nav.features, href: path("/features") },
        { label: t.nav.pricing, href: path("/pricing") },
        { label: t.footer.faq, href: path("/pricing#faq") },
      ],
    },
    {
      title: t.footer.company,
      links: [
        { label: t.footer.about, href: path("/features") },
        { label: t.nav.contact, href: path("/contact") },
        { label: t.footer.careers, href: path("/contact") },
      ],
    },
    {
      title: t.footer.legal,
      links: [
        { label: t.footer.privacy, href: path("/contact") },
        { label: t.footer.terms, href: path("/contact") },
      ],
    },
  ];

  return (
    <footer className="bg-azure-950 text-white">
      <div className="mx-auto grid max-w-7xl gap-12 px-5 py-16 sm:px-8 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <Logo dark href={path("/")} />
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-white/60">
            {t.footer.tagline}
          </p>
        </div>
        {columns.map((col) => (
          <div key={col.title}>
            <h4 className="mb-4 text-sm font-semibold uppercase tracking-wider text-soft-500">
              {col.title}
            </h4>
            <ul className="space-y-2.5">
              {col.links.map((l) => (
                <li key={l.label}>
                  <Link
                    href={l.href}
                    className="text-sm text-white/70 transition hover:text-white"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-7xl justify-center px-5 py-6 text-sm text-white/50 sm:px-8">
          <span>
            © {new Date().getFullYear()} Charta Home. {t.footer.rights}
          </span>
        </div>
      </div>
    </footer>
  );
}
