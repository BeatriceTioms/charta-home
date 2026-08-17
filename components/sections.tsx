"use client";

import Image from "next/image";
import Link from "next/link";
import { useI18n } from "@/lib/i18n/context";
import { LogoMark } from "./Logo";

/* ---------- shared primitives ---------- */

export function CheckIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}

export function ArrowIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  subtitle,
  dark = false,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
  dark?: boolean;
}) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <span className={`text-[13px] font-semibold uppercase tracking-[0.2em] ${dark ? "text-soft-500" : "text-azure-600"}`}>
        {eyebrow}
      </span>
      <h2 className={`mt-4 font-serif text-4xl font-medium tracking-tight sm:text-5xl ${dark ? "text-white" : "text-azure-800"}`}>
        {title}
      </h2>
      {subtitle && (
        <p className={`mt-5 text-lg leading-relaxed ${dark ? "text-white/65" : "text-onyx/55"}`}>
          {subtitle}
        </p>
      )}
    </div>
  );
}

export function PageHero({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
}) {
  return (
    <section className="border-b border-azure-800/5 bg-gradient-to-b from-soft-100 to-white">
      <div className="mx-auto max-w-4xl px-5 py-20 text-center sm:px-8 lg:py-24">
        <span className="text-[13px] font-semibold uppercase tracking-[0.2em] text-azure-600">
          {eyebrow}
        </span>
        <h1 className="mt-4 font-serif text-5xl font-medium tracking-tight text-azure-800 sm:text-6xl">
          {title}
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-onyx/55">
          {subtitle}
        </p>
      </div>
    </section>
  );
}

/* ---------- alternating image and text rows ---------- */

const SHOWCASE_IMAGES = [
  { src: "/photos/building-1.jpg", alt: "building" },
  { src: "/photos/interior-2.jpg", alt: "interior" },
  { src: "/photos/interior-3.jpg", alt: "interior" },
];

export function ShowcaseSection() {
  const { t, path } = useI18n();

  return (
    <section className="bg-white py-24">
      <div className="mb-16">
        <SectionHeading
          eyebrow={t.showcase.eyebrow}
          title={t.showcase.title}
          subtitle={t.showcase.subtitle}
        />
      </div>

      <div className="mx-auto max-w-7xl space-y-20 px-5 sm:px-8 lg:space-y-28">
        {t.showcase.rows.map((row, i) => (
          <div
            key={row.title}
            className={`grid items-center gap-10 lg:grid-cols-2 lg:gap-16 ${
              i % 2 === 1 ? "lg:[&>*:first-child]:order-2" : ""
            }`}
          >
            <div className="relative overflow-hidden rounded-[2rem] shadow-2xl shadow-azure-800/15">
              <Image
                src={SHOWCASE_IMAGES[i].src}
                alt={row.title}
                width={1600}
                height={1200}
                className="aspect-[4/3] w-full object-cover"
              />
              <div className="absolute inset-0 rounded-[2rem] ring-1 ring-inset ring-azure-800/10" />
            </div>
            <div>
              <span className="text-[13px] font-semibold uppercase tracking-[0.2em] text-azure-600">
                {row.eyebrow}
              </span>
              <h3 className="mt-3 font-serif text-4xl font-medium tracking-tight text-azure-800">
                {row.title}
              </h3>
              <p className="mt-4 text-lg leading-relaxed text-onyx/60">{row.description}</p>
              <ul className="mt-6 space-y-3">
                {row.points.map((pt) => (
                  <li key={pt} className="flex items-start gap-3">
                    <span className="mt-1 text-azure-600">
                      <CheckIcon className="h-4 w-4" />
                    </span>
                    <span className="text-onyx/75">{pt}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-14 text-center">
        <Link
          href={path("/features")}
          className="inline-flex items-center gap-2 font-semibold text-azure-600 transition hover:text-azure-800"
        >
          {t.showcase.exploreAll} <ArrowIcon />
        </Link>
      </div>
    </section>
  );
}

/* ---------- stats ---------- */

export function Stats() {
  const { t } = useI18n();
  const stats = [
    { value: "12,000+", label: t.stats.apartments },
    { value: "96%", label: t.stats.onTime },
    { value: "2.4×", label: t.stats.faster },
    { value: "400+", label: t.stats.agencies },
  ];
  return (
    <section className="border-y border-azure-800/5 bg-white">
      <div className="mx-auto grid max-w-7xl grid-cols-2 gap-8 px-5 py-14 sm:px-8 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="text-center">
            <p className="font-serif text-4xl font-medium text-azure-800">{s.value}</p>
            <p className="mt-2 text-sm text-onyx/55">{s.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ---------- how it works ---------- */

export function HowItWorksSection() {
  const { t, path } = useI18n();
  const [one, two, three] = t.howItWorks.steps;

  return (
    <section className="bg-soft-50 py-24">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-1.5 text-sm font-semibold text-azure-800 shadow-sm shadow-azure-800/10">
            <span className="h-2 w-2 rounded-full bg-azure-600" />
            {t.howItWorks.badge}
          </span>
          <h2 className="mt-5 font-serif text-4xl font-medium tracking-tight text-azure-950 sm:text-5xl">
            {t.howItWorks.titleBefore}{" "}
            <span className="text-azure-600">{t.howItWorks.titleAccent}</span>
          </h2>
          <p className="mt-5 text-lg leading-relaxed text-onyx/55">{t.howItWorks.subtitle}</p>
        </div>

        <div className="mt-14 grid items-stretch gap-6 lg:grid-cols-3">
          <div className="flex min-h-[420px] flex-col justify-between rounded-[2rem] border border-azure-800/8 bg-white p-8 shadow-sm shadow-azure-800/5">
            <p className="text-right font-serif text-7xl font-medium text-azure-900/10">.01</p>
            <div>
              <h3 className="text-2xl font-bold text-azure-950">{one.title}</h3>
              <p className="mt-2.5 text-sm leading-relaxed text-onyx/55">{one.description}</p>
            </div>
          </div>

          <div className="relative flex min-h-[420px] flex-col overflow-hidden rounded-[2rem] bg-azure-900 text-white shadow-2xl shadow-azure-900/30">
            <div className="relative z-10 p-8">
              <div className="flex items-start justify-between gap-4">
                <h3 className="text-2xl font-bold">{two.title}</h3>
                <p className="font-serif text-7xl font-medium leading-none text-soft-500/80">.02</p>
              </div>
              <p className="mt-2.5 max-w-xs text-sm leading-relaxed text-white/70">
                {two.description}
              </p>
              <Link
                href={path("/signup")}
                className="mt-5 inline-block rounded-full bg-soft-500 px-6 py-2.5 text-sm font-bold text-azure-950 transition hover:bg-soft-400"
              >
                {"cta" in two ? two.cta : t.cta.button}
              </Link>
            </div>
            <div className="relative mt-auto h-44">
              <Image
                src="/photos/building-2.jpg"
                alt=""
                fill
                className="object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-b from-azure-900 to-transparent" />
            </div>
          </div>

          <div className="flex min-h-[420px] flex-col justify-between rounded-[2rem] border border-azure-800/8 bg-white p-8 shadow-sm shadow-azure-800/5">
            <p className="text-right font-serif text-7xl font-medium text-azure-900/10">.03</p>
            <div>
              <h3 className="text-2xl font-bold text-azure-950">{three.title}</h3>
              <p className="mt-2.5 text-sm leading-relaxed text-onyx/55">{three.description}</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------- pricing ---------- */

export const PLAN_PRICES = { starter: 29, growth: 79, agency: 199 } as const;

export function PricingSection({ standalone = false }: { standalone?: boolean }) {
  const { t, path } = useI18n();

  const plans = [
    { key: "starter" as const, price: PLAN_PRICES.starter, data: t.plans.starter, highlighted: false },
    { key: "growth" as const, price: PLAN_PRICES.growth, data: t.plans.growth, highlighted: true },
    { key: "agency" as const, price: PLAN_PRICES.agency, data: t.plans.agency, highlighted: false },
  ];

  return (
    <section className={`${standalone ? "bg-white" : "bg-soft-50"} py-24`}>
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        {!standalone && (
          <SectionHeading
            eyebrow={t.plans.eyebrow}
            title={t.plans.title}
            subtitle={t.plans.subtitle}
          />
        )}
        <div className={`${standalone ? "" : "mt-14"} grid items-stretch gap-6 lg:grid-cols-3`}>
          {plans.map((p) => (
            <div
              key={p.key}
              className={`relative flex flex-col rounded-3xl p-8 ${
                p.highlighted
                  ? "bg-azure-800 text-white shadow-2xl shadow-azure-800/30 lg:-my-4 lg:py-12"
                  : "border border-azure-800/10 bg-white"
              }`}
            >
              {p.highlighted && (
                <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-soft-500 px-4 py-1 text-xs font-bold uppercase tracking-wide text-azure-800">
                  {t.plans.mostPopular}
                </span>
              )}
              <h3 className={`text-lg font-bold ${p.highlighted ? "text-soft-500" : "text-azure-800"}`}>
                {p.data.name}
              </h3>
              <div className="mt-3 flex items-end gap-1.5">
                <span className="text-5xl font-extrabold tracking-tight">${p.price}</span>
                <span className={`mb-1.5 text-sm ${p.highlighted ? "text-white/60" : "text-onyx/50"}`}>
                  {t.plans.perMonth}
                </span>
              </div>
              <p className={`mt-2.5 text-sm leading-relaxed ${p.highlighted ? "text-white/70" : "text-onyx/55"}`}>
                {p.data.blurb}
              </p>
              <ul className="mt-6 flex-1 space-y-3">
                {p.data.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm">
                    <span className={`mt-0.5 ${p.highlighted ? "text-soft-500" : "text-azure-600"}`}>
                      <CheckIcon className="h-4 w-4" />
                    </span>
                    <span className={p.highlighted ? "text-white/85" : "text-onyx/70"}>{f}</span>
                  </li>
                ))}
              </ul>
              <Link
                href={path(`/signup?plan=${p.key}`)}
                className={`mt-8 rounded-full py-3 text-center text-[15px] font-semibold transition ${
                  p.highlighted
                    ? "bg-soft-500 text-azure-800 hover:bg-soft-400"
                    : "bg-azure-800 text-white hover:bg-azure-900"
                }`}
              >
                {t.plans.cta}
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------- faq ---------- */

export function FaqSection({ limit, standalone = false }: { limit?: number; standalone?: boolean }) {
  const { t, path } = useI18n();
  const faqs = limit ? t.faq.items.slice(0, limit) : t.faq.items;

  return (
    <section className="bg-white py-24">
      <div className="mx-auto max-w-3xl px-5 sm:px-8">
        {!standalone && <SectionHeading eyebrow={t.faq.eyebrow} title={t.faq.title} />}
        <div className={standalone ? "space-y-3" : "mt-12 space-y-3"}>
          {faqs.map((f) => (
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
        {limit && (
          <div className="mt-10 text-center">
            <Link
              href={path("/pricing#faq")}
              className="inline-flex items-center gap-2 font-semibold text-azure-600 transition hover:text-azure-800"
            >
              {t.faq.readAll} <ArrowIcon />
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}

/* ---------- cta ---------- */

export function CtaBanner() {
  const { t, path } = useI18n();
  return (
    <section className="bg-white pb-24 pt-4">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="relative overflow-hidden rounded-[2.5rem] bg-onyx px-8 py-16 text-center text-white sm:px-16">
          <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-soft-500/15 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-20 -left-16 h-64 w-64 rounded-full bg-azure-600/25 blur-3xl" />
          <div className="relative mx-auto flex max-w-2xl flex-col items-center">
            <LogoMark className="h-14 w-14" color="#ffffff" door="#020202" />
            <h2 className="mt-6 font-serif text-4xl font-medium tracking-tight sm:text-5xl">
              {t.cta.title}
            </h2>
            <p className="mt-4 text-lg text-white/70">{t.cta.subtitle}</p>
            <Link
              href={path("/signup")}
              className="mt-8 rounded-full bg-soft-500 px-8 py-3.5 text-[15px] font-bold text-azure-900 transition hover:bg-soft-400"
            >
              {t.cta.button}
            </Link>
            <p className="mt-4 text-sm text-white/50">{t.cta.note}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
