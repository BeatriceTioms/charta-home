import Link from "next/link";
import { Logo, LogoMark } from "@/components/Logo";

export function AuthShell({
  children,
  quote = "Charta Home cut our unpaid rent by half in three months. The WhatsApp reminders do the chasing for us.",
  author = "Fatima A., Director, Horizon Realty",
}: {
  children: React.ReactNode;
  quote?: string;
  author?: string;
}) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      {/* brand panel */}
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-azure-800 p-12 text-white lg:flex">
        <div className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-soft-500/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-24 h-96 w-96 rounded-full bg-azure-600/25 blur-3xl" />

        <Logo dark />

        <div className="relative">
          <LogoMark className="h-20 w-20 opacity-90" color="#ffffff" door="#003152" />
          <blockquote className="mt-8 max-w-md font-serif text-2xl leading-relaxed text-white/90">
            “{quote}”
          </blockquote>
          <p className="mt-4 text-sm font-medium text-soft-500">{author}</p>
        </div>

        <div className="relative flex items-center gap-8 text-sm text-white/60">
          <span>
            <strong className="block font-serif text-2xl text-white">400+</strong>
            agencies
          </span>
          <span>
            <strong className="block font-serif text-2xl text-white">12,000+</strong>
            apartments
          </span>
          <span>
            <strong className="block font-serif text-2xl text-white">96%</strong>
            rent on time
          </span>
        </div>
      </aside>

      {/* form panel */}
      <main className="flex flex-col bg-soft-50 px-6 py-8 sm:px-12">
        <div className="flex items-center justify-between lg:justify-end">
          <span className="lg:hidden">
            <Logo />
          </span>
          <Link
            href="/"
            className="flex items-center gap-1.5 text-sm font-medium text-onyx/50 transition hover:text-azure-800"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M11 18l-6-6 6-6" />
            </svg>
            Back to site
          </Link>
        </div>
        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-md">{children}</div>
        </div>
      </main>
    </div>
  );
}
