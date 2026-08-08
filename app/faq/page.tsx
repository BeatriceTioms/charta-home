import type { Metadata } from "next";
import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { CtaBanner, FaqSection, PageHero } from "@/components/sections";

export const metadata: Metadata = {
  title: "FAQ | Charta Home",
  description:
    "Answers on the free trial, WhatsApp maintenance, ROI calculations, data security, and more.",
};

export default function FaqPage() {
  return (
    <>
      <Navbar />
      <main>
        <PageHero
          eyebrow="FAQ"
          title="Everything you may wish to know"
          subtitle="Straight answers on the trial, WhatsApp maintenance, your data, and how Charta Home calculates returns."
        />
        <div className="bg-white pt-4">
          <FaqSection standalone />
        </div>

        {/* contact */}
        <section className="bg-soft-50 py-20">
          <div className="mx-auto max-w-3xl px-5 text-center sm:px-8">
            <h2 className="font-serif text-4xl font-medium tracking-tight text-azure-800">
              Still have a question?
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-lg text-onyx/55">
              Write to us and a member of our team, a person and not a bot, will
              reply within the day.
            </p>
            <Link
              href="mailto:hello@chartahome.com"
              className="mt-8 inline-block rounded-full bg-azure-800 px-8 py-3.5 text-[15px] font-semibold text-white shadow-lg shadow-azure-800/20 transition hover:bg-azure-900"
            >
              hello@chartahome.com
            </Link>
          </div>
        </section>

        <CtaBanner />
      </main>
      <Footer />
    </>
  );
}
