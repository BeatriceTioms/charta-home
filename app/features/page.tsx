import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import {
  ArrowIcon,
  CtaBanner,
  HowItWorksSection,
} from "@/components/sections";

export const metadata: Metadata = {
  title: "Features",
  description:
    "ROI on every building, smart payment reminders over WhatsApp, SMS, and email, and maintenance tracked from tenant report to confirmed fix. Every Charta Home feature, built for real estate agencies.",
  alternates: { canonical: "/features" },
  openGraph: {
    title: "Charta Home features | ROI, rent, and maintenance in one place",
    description:
      "Know what every building earns, collect rent without chasing, and resolve maintenance over WhatsApp.",
    url: "/features",
    images: ["/hero-door.png"],
  },
};

/* ---------- small pieces ---------- */

function Dot({ className = "" }: { className?: string }) {
  return <span className={`absolute h-2 w-2 rounded-full ${className}`} aria-hidden="true" />;
}

function CheckBullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 border-azure-600 text-azure-600">
        <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 6L9 17l-5-5" />
        </svg>
      </span>
      <span className="text-onyx/75">{children}</span>
    </li>
  );
}

function Cta({ children = "Begin your free month" }: { children?: React.ReactNode }) {
  return (
    <Link
      href="/signup"
      className="inline-block rounded-full bg-azure-800 px-8 py-3.5 text-[15px] font-semibold text-white shadow-lg shadow-azure-800/20 transition hover:bg-azure-900"
    >
      {children}
    </Link>
  );
}

/* ---------- hero ---------- */

function FeaturesHero() {
  return (
    <section className="relative overflow-hidden bg-soft-50">
      {/* decorative dots */}
      <Dot className="left-[12%] top-24 bg-soft-500" />
      <Dot className="left-[38%] top-16 bg-azure-600/60" />
      <Dot className="right-[22%] top-28 bg-azure-600/50" />
      <Dot className="left-[30%] bottom-24 bg-soft-500" />
      <Dot className="right-[9%] bottom-40 bg-soft-500" />

      {/* corner photos, large screens only */}
      <div className="pointer-events-none absolute inset-0 hidden lg:block">
        <Image
          src="/photos/people-1.jpg"
          alt="An agency director"
          width={300}
          height={340}
          className="absolute left-[6%] top-14 h-44 w-36 rounded-[2rem] border-4 border-white object-cover shadow-xl shadow-azure-800/10"
        />
        <Image
          src="/photos/people-2.jpg"
          alt="A property manager"
          width={300}
          height={340}
          className="absolute right-[6%] top-14 h-44 w-36 rounded-[2rem] border-4 border-white object-cover shadow-xl shadow-azure-800/10"
        />
        <div className="absolute bottom-16 left-[8%]">
          <Image
            src="/photos/people-3.jpg"
            alt="Happy tenants"
            width={420}
            height={300}
            className="h-48 w-64 rounded-[2rem] border-4 border-white object-cover shadow-xl shadow-azure-800/10"
          />
          <span className="absolute -right-6 -top-5 grid h-12 w-12 place-items-center rounded-2xl bg-white shadow-lg shadow-azure-800/10">
            <svg viewBox="0 0 24 24" className="h-5 w-5 fill-azure-600" aria-hidden="true">
              <path d="M12 21s-7.5-4.9-9.5-9A5.5 5.5 0 0112 6.7 5.5 5.5 0 0121.5 12c-2 4.1-9.5 9-9.5 9z" />
            </svg>
          </span>
          <span className="absolute -bottom-4 left-40 whitespace-nowrap rounded-full rounded-tl-md bg-white px-4 py-2 text-sm font-semibold text-azure-900 shadow-lg shadow-azure-800/10">
            Rent arrived on time again
          </span>
        </div>
        <div className="absolute bottom-16 right-[8%]">
          <Image
            src="/photos/people-4.jpg"
            alt="An agency team"
            width={420}
            height={300}
            className="h-48 w-64 rounded-[2rem] border-4 border-white object-cover shadow-xl shadow-azure-800/10"
          />
          <span className="absolute -left-6 -top-5 grid h-12 w-12 place-items-center rounded-2xl bg-white shadow-lg shadow-azure-800/10">
            <svg viewBox="0 0 24 24" className="h-5 w-5 text-azure-600" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 3l1.9 5.6L20 10l-6.1 1.4L12 17l-1.9-5.6L4 10l6.1-1.4L12 3z" />
            </svg>
          </span>
        </div>
      </div>

      <div className="relative mx-auto max-w-3xl px-5 py-24 text-center sm:px-8 lg:py-32">
        <p className="font-script text-3xl font-semibold text-azure-600">
          Built for real estate agencies
        </p>
        <h1 className="mt-3 font-serif text-5xl font-medium tracking-tight text-azure-950 sm:text-6xl">
          Every building accounted for. Every rent collected
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-onyx/55">
          At Charta Home, we understand that managing a portfolio is demanding.
          That is why returns, rent, and maintenance live in one calm place.
        </p>
        <div className="mt-8">
          <Cta />
        </div>
      </div>
    </section>
  );
}

/* ---------- who we serve ---------- */

const AUDIENCES = [
  {
    title: "Residential agencies",
    description: "City portfolios with many tenants and many owners to answer to.",
    image: "/photos/city.jpg",
    featured: false,
  },
  {
    title: "Growing portfolios",
    description: "Several buildings across town, each with its own rhythm.",
    image: "/photos/building-1.jpg",
    featured: true,
  },
  {
    title: "Independent landlords",
    description: "A first building, managed with the standards of a fine agency.",
    image: "/photos/building-3.jpg",
    featured: false,
  },
];

function WhoWeServe() {
  return (
    <section className="bg-gradient-to-b from-soft-100 via-soft-50 to-white py-24">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="font-script text-3xl font-semibold text-azure-600">Who we serve?</p>
          <h2 className="mt-3 font-serif text-4xl font-medium tracking-tight text-azure-950 sm:text-5xl">
            Agencies of every size feel at home
          </h2>
          <p className="mt-5 text-lg leading-relaxed text-onyx/55">
            Owning property is one of the finest investments there is. Managing
            it well takes time, expertise, and dedication. That is where we come in.
          </p>
        </div>

        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {AUDIENCES.map((a) => (
            <div
              key={a.title}
              className="rounded-[2rem] border border-white/60 bg-white/30 p-4 shadow-lg shadow-azure-800/5 backdrop-blur-xl transition hover:bg-white/50 hover:shadow-xl hover:shadow-azure-800/10"
            >
              <Image
                src={a.image}
                alt={a.title}
                width={800}
                height={600}
                className="h-56 w-full rounded-3xl object-cover"
              />
              <div className="p-4">
                <h3 className="text-2xl font-bold text-azure-950">{a.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-onyx/55">{a.description}</p>
                <Link
                  href="/pricing"
                  className="mt-5 flex items-center gap-3 text-sm font-bold text-azure-800"
                >
                  <span
                    className={`grid h-11 w-11 place-items-center rounded-2xl transition ${
                      a.featured
                        ? "bg-azure-800 text-white"
                        : "bg-white text-azure-800 shadow-sm shadow-azure-800/10"
                    }`}
                  >
                    <ArrowIcon />
                  </span>
                  <span className="underline decoration-soft-500 decoration-2 underline-offset-4">
                    Learn more
                  </span>
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------- floating cards for the pillar visuals ---------- */

function YieldCard() {
  return (
    <div className="glass w-44 rounded-2xl p-3.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-onyx/60">Portfolio ROI</span>
        <span className="rounded-full bg-soft-200 px-2.5 py-0.5 text-[11px] font-bold text-azure-800">
          This year
        </span>
      </div>
      <p className="mt-1 text-2xl font-extrabold text-azure-800">+12.4%</p>
      <p className="text-[11px] text-onyx/45">vs last year</p>
    </div>
  );
}

function PropertyCard() {
  return (
    <div className="w-64 rounded-2xl bg-white p-3 shadow-2xl shadow-azure-800/20">
      <Image
        src="/photos/interior-2.jpg"
        alt=""
        width={400}
        height={240}
        className="h-24 w-full rounded-xl object-cover"
      />
      <div className="p-2">
        <div className="flex items-center justify-between">
          <p className="text-sm font-bold text-azure-950">Résidence Les Palmiers</p>
          <span className="whitespace-nowrap rounded-full bg-onyx px-2.5 py-0.5 text-[10px] font-bold text-white">
            9.2% net
          </span>
        </div>
        <p className="mt-1 text-xs text-onyx/45">5 apartments · 419 m²</p>
        <div className="mt-2 flex items-center justify-between">
          <p className="text-sm font-extrabold text-azure-800">
            $4,830 <span className="text-[10px] font-medium text-onyx/40">/ month</span>
          </p>
          <span className="text-xs font-semibold text-azure-600">View more</span>
        </div>
      </div>
    </div>
  );
}

function ReminderBubble() {
  return (
    <div className="glass w-64 rounded-2xl rounded-tl-md p-4">
      <p className="text-sm leading-relaxed text-onyx/75">
        Good morning Mrs. Diallo, a gentle reminder that your rent of $1,450 is
        due on 1 September.
      </p>
      <p className="mt-1.5 text-[11px] text-onyx/40">Sent over WhatsApp · 27 Aug</p>
    </div>
  );
}

function OnTimeCard() {
  return (
    <div className="glass w-52 rounded-2xl p-4">
      <p className="text-sm font-bold text-azure-800">96% on time</p>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-azure-800/10">
        <div className="h-full w-[96%] rounded-full bg-azure-700" />
      </div>
      <p className="mt-1.5 text-[11px] text-onyx/45">collected this month</p>
    </div>
  );
}

function TicketReportCard() {
  return (
    <div className="glass w-64 rounded-2xl rounded-tl-md p-4">
      <p className="text-sm leading-relaxed text-onyx/75">
        The kitchen tap is leaking, could someone take a look?
      </p>
      <p className="mt-1.5 text-[11px] text-onyx/40">Apt 1B · over WhatsApp</p>
    </div>
  );
}

function TicketDoneCard() {
  return (
    <div className="glass w-56 rounded-2xl p-4">
      <div className="flex items-center gap-2.5">
        <span className="grid h-9 w-9 place-items-center rounded-full bg-azure-800 text-soft-500">
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6L9 17l-5-5" />
          </svg>
        </span>
        <div>
          <p className="text-sm font-bold text-azure-800">Resolved in 2 days</p>
          <p className="text-[11px] text-onyx/50">tenant confirmed the fix</p>
        </div>
      </div>
    </div>
  );
}

/* ---------- pillar rows ---------- */

type Pillar = {
  eyebrow: string;
  title: string;
  description: string;
  points: string[];
  image: string;
  imageAlt: string;
  topCard: React.ReactNode;
  bottomCard: React.ReactNode;
  reversed?: boolean;
};

const PILLARS: Pillar[] = [
  {
    eyebrow: "Return on investment",
    title: "Know what every building earns. Guaranteed clarity",
    description:
      "Charta Home sets rent collected against every expense and presents the net yield of each apartment, each building, and your portfolio as a whole.",
    points: [
      "Net yield per apartment, building, and portfolio",
      "Occupancy and vacancy cost, always current",
      "Elegant owner statements, ready to share",
    ],
    image: "/photos/building-1.jpg",
    imageAlt: "A modern apartment building",
    topCard: <YieldCard />,
    bottomCard: <PropertyCard />,
  },
  {
    eyebrow: "Rent, on time",
    title: "Reminders that collect. Save time and patience",
    description:
      "Courteous reminders go out before rent is due and measured follow ups after, over WhatsApp, SMS, or email. Your team never has to chase.",
    points: [
      "Scheduled reminders in your agency's tone",
      "Tactful escalation when payment runs late",
      "Receipts and payment history on every lease",
    ],
    image: "/photos/people-5.jpg",
    imageAlt: "An agent welcoming a tenant",
    topCard: <ReminderBubble />,
    bottomCard: <OnTimeCard />,
    reversed: true,
  },
  {
    eyebrow: "Maintenance",
    title: "Issues reported, tracked, and resolved over WhatsApp",
    description:
      "Tenants message a number they already have. Each message becomes a ticket your team assigns and follows until the work is confirmed done.",
    points: [
      "No apps for tenants to install",
      "Assignment, status, and history on every ticket",
      "Resolution times reflected in building ROI",
    ],
    image: "/photos/interior-1.jpg",
    imageAlt: "A well kept modern home",
    topCard: <TicketReportCard />,
    bottomCard: <TicketDoneCard />,
  },
];

function PillarRows() {
  return (
    <section className="bg-white pb-24">
      <div className="mx-auto max-w-7xl space-y-24 px-5 sm:px-8 lg:space-y-32">
        {PILLARS.map((p) => (
          <div
            key={p.title}
            className={`grid items-center gap-12 lg:grid-cols-2 lg:gap-20 ${
              p.reversed ? "lg:[&>*:first-child]:order-2" : ""
            }`}
          >
            {/* visual */}
            <div className="relative mx-auto w-full max-w-lg">
              <Image
                src={p.image}
                alt={p.imageAlt}
                width={900}
                height={700}
                className="aspect-[5/4] w-full rounded-[2.5rem] object-cover shadow-2xl shadow-azure-800/15"
              />
              <div className="absolute -left-3 -top-12 sm:-left-8">{p.topCard}</div>
              <div className="absolute -bottom-6 -right-3 sm:-right-8">{p.bottomCard}</div>
            </div>

            {/* copy */}
            <div>
              <p className="font-script text-3xl font-semibold text-azure-600">{p.eyebrow}</p>
              <h2 className="mt-3 font-serif text-4xl font-medium tracking-tight text-azure-950 sm:text-[44px] sm:leading-[1.15]">
                {p.title}
              </h2>
              <p className="mt-5 text-lg leading-relaxed text-onyx/60">{p.description}</p>
              <ul className="mt-7 space-y-4">
                {p.points.map((pt) => (
                  <CheckBullet key={pt}>{pt}</CheckBullet>
                ))}
              </ul>
              <div className="mt-9">
                <Cta />
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function FeaturesPage() {
  return (
    <>
      <Navbar />
      <main>
        <FeaturesHero />
        <WhoWeServe />
        <PillarRows />
        <div id="journey" className="scroll-mt-20">
          <HowItWorksSection />
        </div>
        <CtaBanner />
      </main>
      <Footer />
    </>
  );
}
