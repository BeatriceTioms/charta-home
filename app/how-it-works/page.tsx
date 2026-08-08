import type { Metadata } from "next";
import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import {
  ArrowIcon,
  CheckIcon,
  CtaBanner,
  PageHero,
  STEPS,
} from "@/components/sections";

export const metadata: Metadata = {
  title: "How it works | Charta Home",
  description:
    "From first login to a fully organized portfolio in an afternoon. See how agencies set up Charta Home.",
};

const REASSURANCES = [
  {
    title: "No consultants required",
    description:
      "Charta Home is designed to be set up by your own team, in plain language, without training sessions.",
  },
  {
    title: "Bring your existing records",
    description:
      "Import tenants and leases from a simple spreadsheet. We provide the template and check it for you.",
  },
  {
    title: "Help from a real person",
    description:
      "Our support team answers within the day on every plan, and Agency plans enjoy dedicated support.",
  },
];

export default function HowItWorksPage() {
  return (
    <>
      <Navbar />
      <main>
        <PageHero
          eyebrow="How it works"
          title="From first login to full clarity"
          subtitle="Five unhurried steps. Most agencies complete them in a single afternoon."
        />

        {/* timeline */}
        <section className="bg-white py-20">
          <div className="mx-auto max-w-3xl px-5 sm:px-8">
            <ol className="relative space-y-12 border-l-2 border-soft-200 pl-10">
              {STEPS.map((s) => (
                <li key={s.n} className="relative">
                  <span className="absolute -left-[54px] grid h-9 w-9 place-items-center rounded-full bg-azure-800 font-serif text-sm font-medium text-soft-500">
                    {s.n}
                  </span>
                  <h2 className="text-2xl font-bold text-azure-800">{s.title}</h2>
                  <p className="mt-2 leading-relaxed text-onyx/60">{s.description}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* reassurance */}
        <section className="bg-soft-50 py-20">
          <div className="mx-auto max-w-7xl px-5 sm:px-8">
            <h2 className="text-center font-serif text-4xl font-medium tracking-tight text-azure-800">
              Set up with a steady hand
            </h2>
            <div className="mt-12 grid gap-6 md:grid-cols-3">
              {REASSURANCES.map((r) => (
                <div key={r.title} className="rounded-3xl border border-azure-800/8 bg-white p-8">
                  <span className="grid h-10 w-10 place-items-center rounded-full bg-soft-200 text-azure-800">
                    <CheckIcon className="h-5 w-5" />
                  </span>
                  <h3 className="mt-4 text-lg font-bold text-azure-800">{r.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-onyx/60">{r.description}</p>
                </div>
              ))}
            </div>
            <div className="mt-12 text-center">
              <Link
                href="/features"
                className="inline-flex items-center gap-2 font-semibold text-azure-600 transition hover:text-azure-800"
              >
                Explore what you unlock <ArrowIcon />
              </Link>
            </div>
          </div>
        </section>

        <CtaBanner />
      </main>
      <Footer />
    </>
  );
}
