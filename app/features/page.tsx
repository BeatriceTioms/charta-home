import type { Metadata } from "next";
import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import {
  ArrowIcon,
  CtaBanner,
  FEATURES,
  FeatureCard,
  ImageTextRows,
  PageHero,
  type ShowcaseRow,
} from "@/components/sections";

export const metadata: Metadata = {
  title: "Features | Charta Home",
  description:
    "ROI on every building, smart payment reminders, and maintenance handled over WhatsApp. Every feature built for real estate agencies.",
};

const PILLARS: ShowcaseRow[] = [
  {
    eyebrow: "Return on investment",
    title: "Know exactly what every building earns",
    description:
      "Charta Home sets rent collected against every expense, from maintenance to charges to vacancies, and presents the net yield of each apartment, each building, and your portfolio as a whole. The clarity your owners expect, without the spreadsheets.",
    points: [
      "Net yield per apartment, building, and portfolio",
      "Occupancy and vacancy cost, always current",
      "Elegant owner statements, ready to share",
    ],
    image: "/photos/city.jpg",
    imageAlt: "Apartment buildings seen from the street",
  },
  {
    eyebrow: "Rent, on time",
    title: "Reminders that collect without chasing",
    description:
      "Well mannered reminders go out before rent is due, and measured follow ups after, over WhatsApp, SMS, or email. Your tenants are treated with courtesy. Your cash flow is treated with respect.",
    points: [
      "Scheduled reminders in your agency's tone",
      "Escalation paths for late payment, handled tactfully",
      "Receipts and payment history on every lease",
    ],
    image: "/photos/interior-4.jpg",
    imageAlt: "A bright, welcoming apartment interior",
  },
  {
    eyebrow: "Maintenance",
    title: "Every issue reported, tracked, and resolved",
    description:
      "Tenants message a WhatsApp number they already have. Charta Home turns each message into a ticket your team can assign and track, and keeps the tenant informed until the work is confirmed done.",
    points: [
      "No apps for tenants to install. WhatsApp is enough",
      "Assignment, status, and history on every ticket",
      "Resolution times reflected in your building ROI",
    ],
    image: "/photos/interior-1.jpg",
    imageAlt: "A well maintained modern home in the evening",
  },
];

export default function FeaturesPage() {
  return (
    <>
      <Navbar />
      <main>
        <PageHero
          eyebrow="Features"
          title="Built around how fine agencies work"
          subtitle="Three disciplines, handled with the care your portfolio deserves: returns, rent, and maintenance."
        />

        <section className="bg-white py-20">
          <ImageTextRows rows={PILLARS} />
        </section>

        <section className="bg-soft-50 py-20">
          <div className="mx-auto max-w-7xl px-5 sm:px-8">
            <h2 className="text-center font-serif text-4xl font-medium tracking-tight text-azure-800">
              And everything around them
            </h2>
            <div className="mt-12 grid gap-6 md:grid-cols-3">
              {FEATURES.slice(3).map((f) => (
                <FeatureCard key={f.title} feature={f} />
              ))}
            </div>
            <div className="mt-12 text-center">
              <Link
                href="/pricing"
                className="inline-flex items-center gap-2 font-semibold text-azure-600 transition hover:text-azure-800"
              >
                See which plan fits your portfolio <ArrowIcon />
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
