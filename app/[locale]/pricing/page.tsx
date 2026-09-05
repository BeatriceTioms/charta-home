"use client";

import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { CtaBanner, FaqSection, PageHero, PricingSection, SectionHeading } from "@/components/sections";
import { useI18n } from "@/lib/i18n/context";

/**
 * The tiers, the two toggles that change a price, how one pays, the table,
 * and the questions. The section owns the country and cycle because the
 * table underneath has to show the same ones the cards do.
 */
export default function PricingPage() {
  const { t } = useI18n();

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
        <PageHero eyebrow={t.plans.eyebrow} title={t.plans.title} subtitle={t.plans.subtitle} />

        <PricingSection standalone />

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
