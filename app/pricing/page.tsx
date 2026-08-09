import type { Metadata } from "next";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import {
  CtaBanner,
  FaqSection,
  PageHero,
  PricingSection,
  SectionHeading,
} from "@/components/sections";

export const metadata: Metadata = {
  title: "Pricing | Charta Home",
  description:
    "Three transparent monthly plans. Every plan begins with a full month free. No credit card required.",
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
            <h2 className="text-center font-serif text-4xl font-medium tracking-tight text-azure-800">
              Compare the plans
            </h2>
            <div className="mt-12 overflow-x-auto rounded-3xl border border-azure-800/10 bg-white shadow-xl shadow-azure-800/5">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="border-b border-azure-800/10">
                    <th className="px-6 py-4 font-semibold text-onyx/50"> </th>
                    <th className="px-6 py-4 font-bold text-azure-800">Starter</th>
                    <th className="bg-soft-100 px-6 py-4 font-bold text-azure-800">Growth</th>
                    <th className="px-6 py-4 font-bold text-azure-800">Agency</th>
                  </tr>
                </thead>
                <tbody>
                  {COMPARISON.map((row) => (
                    <tr key={row.label} className="border-b border-azure-800/5 last:border-0">
                      <td className="px-6 py-3.5 font-semibold text-onyx/70">{row.label}</td>
                      <td className="px-6 py-3.5 text-onyx/60">{row.values[0]}</td>
                      <td className="bg-soft-100/60 px-6 py-3.5 font-medium text-azure-800">{row.values[1]}</td>
                      <td className="px-6 py-3.5 text-onyx/60">{row.values[2]}</td>
                    </tr>
                  ))}
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
