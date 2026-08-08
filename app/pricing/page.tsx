import type { Metadata } from "next";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import {
  CtaBanner,
  FAQS,
  PageHero,
  PricingSection,
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

const PRICING_FAQS = FAQS.filter((f) =>
  ["How does the free first month work?", "Can I switch plans later?", "What happens after the free month?"].includes(f.q)
);

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

        {/* pricing faq */}
        <section className="bg-white py-20">
          <div className="mx-auto max-w-3xl px-5 sm:px-8">
            <h2 className="text-center font-serif text-4xl font-medium tracking-tight text-azure-800">
              Before you decide
            </h2>
            <div className="mt-10 space-y-3">
              {PRICING_FAQS.map((f) => (
                <details
                  key={f.q}
                  className="group rounded-2xl border border-azure-800/10 bg-soft-50 px-6 py-4 open:bg-white open:shadow-lg open:shadow-azure-800/5"
                >
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[15px] font-semibold text-azure-800 [&::-webkit-details-marker]:hidden">
                    {f.q}
                    <span className="text-xl text-azure-600 transition group-open:rotate-45">+</span>
                  </summary>
                  <p className="mt-3 text-sm leading-relaxed text-onyx/60">{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <CtaBanner />
      </main>
      <Footer />
    </>
  );
}
