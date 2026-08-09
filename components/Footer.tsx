import Link from "next/link";
import { Logo } from "./Logo";

const columns = [
  {
    title: "Product",
    links: [
      { label: "Features", href: "/features" },
      { label: "How it works", href: "/how-it-works" },
      { label: "Pricing", href: "/pricing" },
      { label: "FAQ", href: "/faq" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", href: "#" },
      { label: "Contact", href: "#" },
      { label: "Careers", href: "#" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Privacy policy", href: "#" },
      { label: "Terms of service", href: "#" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="bg-azure-950 text-white">
      <div className="mx-auto grid max-w-7xl gap-12 px-5 py-16 sm:px-8 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <Logo dark />
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-white/60">
            The property management platform built for real estate agencies.
            ROI insights, smart rent collection, and maintenance handled over
            WhatsApp.
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
          <span>© {new Date().getFullYear()} Charta Home. All rights reserved.</span>
        </div>
      </div>
    </footer>
  );
}
