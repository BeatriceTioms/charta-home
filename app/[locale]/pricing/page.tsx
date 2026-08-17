"use client";

import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import {
  CtaBanner,
  FaqSection,
  PageHero,
  PLAN_PRICES,
  PricingSection,
  SectionHeading,
} from "@/components/sections";
import { useI18n } from "@/lib/i18n/context";

export default function PricingPage() {
  const { t, path } = useI18n();
  const c = t.plans.compare;
  const v = c.values;

  const rows: { label: string; values: [string, string, string] }[] = [
    { label: c.rows.buildings, values: ["1", v.upTo5, v.unlimited] },
    { label: c.rows.apartments, values: ["20", "150", v.unlimited] },
    { label: c.rows.members, values: ["1", "5", v.unlimited] },
    { label: c.rows.roi, values: [v.included, v.perUnit, v.advanced] },
    { label: c.rows.reminders, values: [v.email, v.allChannels, v.allWithEscalation] },
    { label: c.rows.whatsapp, values: [v.notIncluded, v.included, v.priority] },
    { label: c.rows.ownerReports, values: [v.notIncluded, v.included, v.included] },
    { label: c.rows.support, values: [v.standard, v.standard, v.dedicated] },
  ];

  const plans = [
    { key: "starter" as const, name: t.plans.starter.name, price: PLAN_PRICES.starter },
    { key: "growth" as const, name: t.plans.growth.name, price: PLAN_PRICES.growth },
    { key: "agency" as const, name: t.plans.agency.name, price: PLAN_PRICES.agency },
  ];

  const faqStructuredData = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: t.faq.items.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqStructuredData) }}
      />
      <Navbar />
      <main>
        <PageHero
          eyebrow={t.plans.eyebrow}
          title={t.plans.title}
          subtitle={t.plans.subtitle}
        />

        <PricingSection standalone />

        {/* comparison table */}
        <section className="bg-soft-50 py-20">
          <div className="mx-auto max-w-5xl px-5 sm:px-8">
            <div className="text-center">
              <span className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-1.5 text-sm font-semibold text-azure-800 shadow-sm shadow-azure-800/10">
                <span className="h-2 w-2 rounded-full bg-azure-600" />
                {c.badge}
              </span>
              <h2 className="mt-5 font-serif text-4xl font-medium tracking-tight text-azure-950">
                {c.title}
              </h2>
            </div>

            <div className="mt-12 overflow-x-auto rounded-[2rem] border border-azure-800/10 bg-white shadow-xl shadow-azure-800/10">
              <table className="w-full min-w-[680px] text-left text-sm">
                <thead>
                  <tr>
                    <th className="w-[30%] px-7 pb-4 pt-7 align-bottom text-xs font-semibold uppercase tracking-wider text-onyx/40">
                      {c.whatYouGet}
                    </th>
                    {plans.map((p, i) => (
                      <th
                        key={p.key}
                        className={
                          i === 1
                            ? "w-[24%] bg-azure-800 px-5 pb-4 pt-6 align-bottom text-white"
                            : "w-[23%] px-5 pb-4 pt-7 align-bottom"
                        }
                      >
                        {i === 1 && (
                          <span className="mb-2 inline-block rounded-full bg-soft-500 px-3 py-0.5 text-[10px] font-bold uppercase tracking-wide text-azure-950">
                            {t.plans.mostPopular}
                          </span>
                        )}
                        <p className={`text-base font-bold ${i === 1 ? "" : "text-azure-950"}`}>
                          {p.name}
                        </p>
                        <p className={`mt-0.5 text-sm font-medium ${i === 1 ? "text-white/60" : "text-onyx/45"}`}>
                          ${p.price} <span className="text-xs">{t.plans.perMonth}</span>
                        </p>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => (
                    <tr key={row.label} className={i % 2 === 0 ? "bg-soft-50/60" : ""}>
                      <td className="px-7 py-4 font-semibold text-azure-950">{row.label}</td>
                      {row.values.map((value, col) => (
                        <td
                          key={col}
                          className={`px-5 py-4 ${
                            col === 1 ? "bg-azure-800/[0.04] font-semibold text-azure-950" : "text-onyx/65"
                          }`}
                        >
                          {value === v.included ? (
                            <span className="grid h-7 w-7 place-items-center rounded-full bg-onyx text-white">
                              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M20 6L9 17l-5-5" />
                              </svg>
                            </span>
                          ) : value === v.notIncluded ? (
                            <span className="grid h-7 w-7 place-items-center rounded-full border border-azure-900/15 text-onyx/25">
                              <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                                <path d="M6 6l12 12M18 6L6 18" />
                              </svg>
                            </span>
                          ) : (
                            value
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                  <tr>
                    <td className="px-7 py-6" />
                    {plans.map((p, i) => (
                      <td key={p.key} className={i === 1 ? "bg-azure-800/[0.04] px-5 py-6" : "px-5 py-6"}>
                        <Link
                          href={path(`/signup?plan=${p.key}`)}
                          className={
                            i === 1
                              ? "inline-block rounded-full bg-azure-800 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-azure-800/20 transition hover:bg-azure-900"
                              : "inline-block rounded-full border border-azure-800/20 px-5 py-2.5 text-sm font-semibold text-azure-800 transition hover:bg-soft-100"
                          }
                        >
                          {c.choose} {p.name}
                        </Link>
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="mt-6 text-center text-sm text-onyx/45">{c.note}</p>
          </div>
        </section>

        {/* full faq */}
        <section id="faq" className="scroll-mt-20 bg-white pt-24">
          <div className="px-5 sm:px-8">
            <SectionHeading eyebrow={t.faq.eyebrow} title={t.faq.title} subtitle={t.faq.subtitle} />
          </div>
          <FaqSection standalone />
        </section>

        <CtaBanner />
      </main>
      <Footer />
    </>
  );
}
