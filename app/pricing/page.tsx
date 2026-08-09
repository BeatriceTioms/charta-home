import type { Metadata } from "next";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import {
  CtaBanner,
  FAQS,
  FaqSection,
  PageHero,
  PricingSection,
  SectionHeading,
} from "@/components/sections";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Three transparent monthly plans for real estate agencies: Starter at $29, Growth at $79, and Agency at $199. Every plan begins with a full month free, no credit card required.",
  alternates: { canonical: "/pricing" },
  openGraph: {
    title: "Charta Home pricing | Simple plans, first month free",
    description:
      "Starter $29, Growth $79, Agency $199 per month. Every plan starts with a free month, no credit card.",
    url: "/pricing",
    images: ["/hero-door.png"],
  },
};

const faqStructuredData = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQS.map((f) => ({
    "@type": "Question",
    name: f.q,
    acceptedAnswer: { "@type": "Answer", text: f.a },
  })),
};

const COMPARISON: { label: string; values: [string, string, string] }[] = [
  { label: "Buildings", values: ["1", "Up to 5", "Unlimited"] },
  { label: "Apartments", values: ["20", "150", "Unlimited"] },
  { label: "Team members", values: ["1", "5", "Unlimited"] },
  { label: "ROI dashboard", values: ["Included", "Per unit analytics", "Advanced"] },
  { label: "Payment reminders", values: ["Email", "WhatsApp · SMS · Email", "All, with escalations"] },
  { label: "Maintenance over WhatsApp", values: ["Not included", "Included", "Priority flows"] },
  { label: "Owner reports", values: ["Not included", "Included", "Included"] },
  { label: "Support", values: ["Standard", "Standard", "Dedicated"] },
];

export default function PricingPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqStructuredData) }}
      />
      <Navbar />
      <main>
        <PageHero
          eyebrow="Pricing"
          title="Transparent plans, priced monthly"
          subtitle="Every plan begins with a full month on us. Every feature, no credit card, no obligation. Choose the plan that fits your portfolio today and change it whenever your portfolio grows."
        />

        <PricingSection standalone />

        {/* comparison table */}
        <section className="bg-soft-50 py-20">
          <div className="mx-auto max-w-5xl px-5 sm:px-8">
            <div className="text-center">
              <span className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-1.5 text-sm font-semibold text-azure-800 shadow-sm shadow-azure-800/10">
                <span className="h-2 w-2 rounded-full bg-azure-600" />
                Side by side
              </span>
              <h2 className="mt-5 font-serif text-4xl font-medium tracking-tight text-azure-950">
                Compare the plans
              </h2>
            </div>

            <div className="mt-12 overflow-x-auto rounded-[2rem] border border-azure-800/10 bg-white shadow-xl shadow-azure-800/10">
              <table className="w-full min-w-[680px] text-left text-sm">
                <thead>
                  <tr>
                    <th className="w-[30%] px-7 pb-4 pt-7 align-bottom text-xs font-semibold uppercase tracking-wider text-onyx/40">
                      What you get
                    </th>
                    <th className="w-[22%] px-5 pb-4 pt-7 align-bottom">
                      <p className="text-base font-bold text-azure-950">Starter</p>
                      <p className="mt-0.5 text-sm font-medium text-onyx/45">
                        $29 <span className="text-xs">/ month</span>
                      </p>
                    </th>
                    <th className="w-[24%] bg-azure-800 px-5 pb-4 pt-6 align-bottom text-white">
                      <span className="mb-2 inline-block rounded-full bg-soft-500 px-3 py-0.5 text-[10px] font-bold uppercase tracking-wide text-azure-950">
                        Most popular
                      </span>
                      <p className="text-base font-bold">Growth</p>
                      <p className="mt-0.5 text-sm font-medium text-white/60">
                        $79 <span className="text-xs">/ month</span>
                      </p>
                    </th>
                    <th className="w-[24%] px-5 pb-4 pt-7 align-bottom">
                      <p className="text-base font-bold text-azure-950">Agency</p>
                      <p className="mt-0.5 text-sm font-medium text-onyx/45">
                        $199 <span className="text-xs">/ month</span>
                      </p>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {COMPARISON.map((row, i) => (
                    <tr key={row.label} className={i % 2 === 0 ? "bg-soft-50/60" : ""}>
                      <td className="px-7 py-4 font-semibold text-azure-950">{row.label}</td>
                      {row.values.map((v, col) => (
                        <td
                          key={col}
                          className={`px-5 py-4 ${col === 1 ? "bg-azure-800/[0.04] font-semibold text-azure-950" : "text-onyx/65"}`}
                        >
                          {v === "Included" ? (
                            <span className="grid h-7 w-7 place-items-center rounded-full bg-onyx text-white">
                              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M20 6L9 17l-5-5" />
                              </svg>
                            </span>
                          ) : v === "Not included" ? (
                            <span className="grid h-7 w-7 place-items-center rounded-full border border-azure-900/15 text-onyx/25">
                              <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                                <path d="M6 6l12 12M18 6L6 18" />
                              </svg>
                            </span>
                          ) : (
                            v
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                  <tr>
                    <td className="px-7 py-6" />
                    <td className="px-5 py-6">
                      <a href="/signup" className="inline-block rounded-full border border-azure-800/20 px-5 py-2.5 text-sm font-semibold text-azure-800 transition hover:bg-soft-100">
                        Choose Starter
                      </a>
                    </td>
                    <td className="bg-azure-800/[0.04] px-5 py-6">
                      <a href="/signup" className="inline-block rounded-full bg-azure-800 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-azure-800/20 transition hover:bg-azure-900">
                        Choose Growth
                      </a>
                    </td>
                    <td className="px-5 py-6">
                      <a href="/signup" className="inline-block rounded-full border border-azure-800/20 px-5 py-2.5 text-sm font-semibold text-azure-800 transition hover:bg-soft-100">
                        Choose Agency
                      </a>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="mt-6 text-center text-sm text-onyx/45">
              Prices shown in US dollars, billed monthly. Cancel at any time. Your data remains exportable for 90 days.
            </p>
          </div>
        </section>

        {/* full faq, merged from the former FAQ page */}
        <section id="faq" className="scroll-mt-20 bg-white pt-24">
          <div className="px-5 sm:px-8">
            <SectionHeading
              eyebrow="FAQ"
              title="Everything you may wish to know"
              subtitle="Straight answers on the trial, WhatsApp maintenance, your data, and how Charta Home calculates returns."
            />
          </div>
          <FaqSection standalone />
        </section>

        <CtaBanner />
      </main>
      <Footer />
    </>
  );
}
