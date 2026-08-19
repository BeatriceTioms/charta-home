"use client";

import Image from "next/image";
import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { ArrowIcon, CheckIcon, CtaBanner, HowItWorksSection } from "@/components/sections";
import { useI18n } from "@/lib/i18n/context";

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

function Cta() {
  const { t, path } = useI18n();
  return (
    <Link
      href={path("/signup")}
      className="inline-block rounded-full bg-azure-800 px-8 py-3.5 text-[15px] font-semibold text-white shadow-lg shadow-azure-800/20 transition hover:bg-azure-900"
    >
      {t.featuresPage.cta}
    </Link>
  );
}

function FeaturesHero() {
  const { t } = useI18n();
  return (
    <section className="relative overflow-hidden bg-soft-50">
      <Dot className="left-[12%] top-24 bg-soft-500" />
      <Dot className="left-[38%] top-16 bg-azure-600/60" />
      <Dot className="right-[22%] top-28 bg-azure-600/50" />
      <Dot className="left-[30%] bottom-24 bg-soft-500" />
      <Dot className="right-[9%] bottom-40 bg-soft-500" />

      <div className="pointer-events-none absolute inset-0 hidden lg:block">
        <Image
          src="/photos/people-1.jpg"
          alt=""
          width={300}
          height={340}
          className="absolute left-[6%] top-14 h-44 w-36 rounded-[2rem] border-4 border-white object-cover shadow-xl shadow-azure-800/10"
        />
        <Image
          src="/photos/people-2.jpg"
          alt=""
          width={300}
          height={340}
          className="absolute right-[6%] top-14 h-44 w-36 rounded-[2rem] border-4 border-white object-cover shadow-xl shadow-azure-800/10"
        />
        <div className="absolute bottom-16 left-[8%]">
          <Image
            src="/photos/people-3.jpg"
            alt=""
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
            {t.featuresPage.heroBubble}
          </span>
        </div>
        <div className="absolute bottom-16 right-[8%]">
          <Image
            src="/photos/people-4.jpg"
            alt=""
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
          {t.featuresPage.heroEyebrow}
        </p>
        <h1 className="mt-3 font-serif text-5xl font-medium tracking-tight text-azure-950 sm:text-6xl">
          {t.featuresPage.heroTitle}
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-onyx/55">
          {t.featuresPage.heroSubtitle}
        </p>
        <div className="mt-8">
          <Cta />
        </div>
      </div>
    </section>
  );
}

const AUDIENCE_IMAGES = ["/photos/city.jpg", "/photos/building-1.jpg", "/photos/building-3.jpg"];

function WhoWeServe() {
  const { t, path } = useI18n();
  return (
    <section className="bg-gradient-to-b from-soft-100 via-soft-50 to-white py-24">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="font-script text-3xl font-semibold text-azure-600">
            {t.featuresPage.audienceEyebrow}
          </p>
          <h2 className="mt-3 font-serif text-4xl font-medium tracking-tight text-azure-950 sm:text-5xl">
            {t.featuresPage.audienceTitle}
          </h2>
          <p className="mt-5 text-lg leading-relaxed text-onyx/55">
            {t.featuresPage.audienceSubtitle}
          </p>
        </div>

        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {t.featuresPage.audiences.map((a, i) => (
            <div
              key={a.title}
              className="rounded-[2rem] border border-white/60 bg-white/30 p-4 shadow-lg shadow-azure-800/5 backdrop-blur-xl transition hover:bg-white/50 hover:shadow-xl hover:shadow-azure-800/10"
            >
              <Image
                src={AUDIENCE_IMAGES[i]}
                alt={a.title}
                width={800}
                height={600}
                className="h-56 w-full rounded-3xl object-cover"
              />
              <div className="p-4">
                <h3 className="text-2xl font-bold text-azure-950">{a.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-onyx/55">{a.description}</p>
                <Link
                  href={path("/pricing")}
                  className="mt-5 flex items-center gap-3 text-sm font-bold text-azure-800"
                >
                  <span
                    className={`grid h-11 w-11 place-items-center rounded-2xl transition ${
                      i === 1
                        ? "bg-azure-800 text-white"
                        : "bg-white text-azure-800 shadow-sm shadow-azure-800/10"
                    }`}
                  >
                    <ArrowIcon />
                  </span>
                  <span className="underline decoration-soft-500 decoration-2 underline-offset-4">
                    {t.featuresPage.learnMore}
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

/* floating cards over the pillar photos */

function YieldCard() {
  const { t } = useI18n();
  return (
    <div className="glass w-44 rounded-2xl p-3.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-onyx/60">ROI</span>
        <span className="rounded-full bg-soft-200 px-2.5 py-0.5 text-[11px] font-bold text-azure-800">
          {t.dash.overview.thisMonth}
        </span>
      </div>
      <p className="mt-1 text-2xl font-extrabold text-azure-800">+12.4%</p>
      <p className="text-[11px] text-onyx/45">{t.dash.apartment.yearToDate}</p>
    </div>
  );
}

function PropertyCard() {
  const { t } = useI18n();
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
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-bold text-azure-950">Résidence Les Palmiers</p>
          <span className="whitespace-nowrap rounded-full bg-onyx px-2.5 py-0.5 text-[10px] font-bold text-white">
            9.2% net
          </span>
        </div>
        <p className="mt-1 text-xs text-onyx/45">5 {t.dash.apartments.countMany} · 419 m²</p>
        <div className="mt-2 flex items-center justify-between">
          <p className="text-sm font-extrabold text-azure-800">
            $4,830 <span className="text-[10px] font-medium text-onyx/40">{t.dash.common.perMonth}</span>
          </p>
          <span className="text-xs font-semibold text-azure-600">{t.dash.common.view}</span>
        </div>
      </div>
    </div>
  );
}

function ReminderBubble() {
  const { t, f } = useI18n();
  return (
    <div className="glass w-64 rounded-2xl rounded-tl-md p-4">
      <p className="text-sm leading-relaxed text-onyx/75">
        {f(t.dash.apartment.reminderModal.message, {
          name: "Mariam",
          amount: "$1,450",
          apartment: "Apt 1A",
        })}
      </p>
      <p className="mt-1.5 text-[11px] text-onyx/40">WhatsApp · 27</p>
    </div>
  );
}

function OnTimeCard() {
  const { t } = useI18n();
  return (
    <div className="glass w-52 rounded-2xl p-4">
      <p className="text-sm font-bold text-azure-800">96%</p>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-azure-800/10">
        <div className="h-full w-[96%] rounded-full bg-azure-700" />
      </div>
      <p className="mt-1.5 text-[11px] text-onyx/45">{t.stats.onTime}</p>
    </div>
  );
}

function TicketReportCard() {
  const { t } = useI18n();
  return (
    <div className="glass w-64 rounded-2xl rounded-tl-md p-4">
      <p className="text-sm leading-relaxed text-onyx/75">
        {t.featuresPage.ticketSample}
      </p>
      <p className="mt-1.5 text-[11px] text-onyx/40">Apt 1B · WhatsApp</p>
    </div>
  );
}

function TicketDoneCard() {
  const { t } = useI18n();
  return (
    <div className="glass w-56 rounded-2xl p-4">
      <div className="flex items-center gap-2.5">
        <span className="grid h-9 w-9 place-items-center rounded-full bg-azure-800 text-soft-500">
          <CheckIcon className="h-4 w-4" />
        </span>
        <div>
          <p className="text-sm font-bold text-azure-800">{t.dash.status.resolved}</p>
          <p className="text-[11px] text-onyx/50">2 {t.dash.common.days}</p>
        </div>
      </div>
    </div>
  );
}

const PILLAR_IMAGES = ["/photos/building-1.jpg", "/photos/people-5.jpg", "/photos/interior-1.jpg"];

function PillarRows() {
  const { t } = useI18n();
  const cards = [
    [<YieldCard key="y" />, <PropertyCard key="p" />],
    [<ReminderBubble key="r" />, <OnTimeCard key="o" />],
    [<TicketReportCard key="tr" />, <TicketDoneCard key="td" />],
  ];

  return (
    <section className="bg-white pb-24">
      <div className="mx-auto max-w-7xl space-y-24 px-5 sm:px-8 lg:space-y-32">
        {t.featuresPage.pillars.map((p, i) => (
          <div
            key={p.title}
            className={`grid items-center gap-12 lg:grid-cols-2 lg:gap-20 ${
              i === 1 ? "lg:[&>*:first-child]:order-2" : ""
            }`}
          >
            <div className="relative mx-auto w-full max-w-lg">
              <Image
                src={PILLAR_IMAGES[i]}
                alt={p.title}
                width={900}
                height={700}
                className="aspect-[5/4] w-full rounded-[2.5rem] object-cover shadow-2xl shadow-azure-800/15"
              />
              <div className="absolute -left-3 -top-12 sm:-left-8">{cards[i][0]}</div>
              <div className="absolute -bottom-6 -right-3 sm:-right-8">{cards[i][1]}</div>
            </div>

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

const EXTRA_ICONS = [
  <svg key="a" viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8zM14 2v6h6M9 13h6M9 17h4" />
  </svg>,
  <svg key="b" viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 20V10M10 20V4M16 20v-8M2 20h20" />
  </svg>,
  <svg key="c" viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
  </svg>,
];

export default function FeaturesPage() {
  const { t, path } = useI18n();

  return (
    <>
      <Navbar />
      <main>
        <FeaturesHero />
        <WhoWeServe />
        <PillarRows />

        <section className="bg-soft-50 py-20">
          <div className="mx-auto max-w-7xl px-5 sm:px-8">
            <h2 className="text-center font-serif text-4xl font-medium tracking-tight text-azure-800">
              {t.featuresPage.everythingAround}
            </h2>
            <div className="mt-12 grid gap-6 md:grid-cols-3">
              {t.featuresPage.extra.map((f, i) => (
                <div
                  key={f.title}
                  className="group rounded-3xl border border-azure-800/8 bg-white p-8 transition hover:border-azure-800/20 hover:shadow-xl hover:shadow-azure-800/5"
                >
                  <span className="grid h-12 w-12 place-items-center rounded-2xl bg-azure-800 text-soft-500 transition group-hover:scale-105">
                    {EXTRA_ICONS[i]}
                  </span>
                  <h3 className="mt-5 text-xl font-bold text-azure-800">{f.title}</h3>
                  <p className="mt-2.5 leading-relaxed text-onyx/60">{f.description}</p>
                </div>
              ))}
            </div>
            <div className="mt-12 text-center">
              <Link
                href={path("/pricing")}
                className="inline-flex items-center gap-2 font-semibold text-azure-600 transition hover:text-azure-800"
              >
                {t.featuresPage.seeWhichPlan} <ArrowIcon />
              </Link>
            </div>
          </div>
        </section>

        <div id="journey" className="scroll-mt-20">
          <HowItWorksSection />
        </div>

        <section className="bg-white py-20">
          <div className="mx-auto max-w-7xl px-5 sm:px-8">
            <h2 className="text-center font-serif text-4xl font-medium tracking-tight text-azure-800">
              {t.featuresPage.reassureTitle}
            </h2>
            <div className="mt-12 grid gap-6 md:grid-cols-3">
              {t.featuresPage.reassurances.map((r) => (
                <div key={r.title} className="rounded-3xl border border-azure-800/8 bg-soft-50 p-8">
                  <span className="grid h-10 w-10 place-items-center rounded-full bg-soft-200 text-azure-800">
                    <CheckIcon className="h-5 w-5" />
                  </span>
                  <h3 className="mt-4 text-lg font-bold text-azure-800">{r.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-onyx/60">{r.description}</p>
                </div>
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
