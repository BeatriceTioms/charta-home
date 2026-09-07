"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { formatMoney } from "@/lib/data";
import { useI18n } from "@/lib/i18n/context";
import {
  ANNUAL_MONTHS,
  PLAN_BANDS,
  PLAN_CODES,
  tierName,
  PRICING_COUNTRIES,
  priceFor,
  type BillingCycle,
  type PlanCode,
  type PricingCountry,
} from "@/lib/pricing";
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

/**
 * Two pills. Used for the country and for the billing cycle, which are the
 * only two things that change a price.
 */
function Toggle<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string; hint?: string }[];
  onChange: (next: T) => void;
}) {
  return (
    <div className="flex flex-col items-center gap-2">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-onyx/40">{label}</span>
      <div role="radiogroup" aria-label={label} className="inline-flex rounded-full border border-azure-800/15 bg-white p-1 shadow-sm shadow-azure-800/5">
        {options.map((o) => {
          const active = o.value === value;
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(o.value)}
              className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${
                active ? "bg-azure-800 text-white shadow" : "text-azure-800 hover:bg-soft-100"
              }`}
            >
              {o.label}
              {o.hint && (
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                  active ? "bg-soft-500 text-azure-950" : "bg-soft-200 text-azure-800"
                }`}>
                  {o.hint}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** The three tiers, priced for one country and one cycle. */
export function PricingSection({ standalone = false }: { standalone?: boolean }) {
  const { t, path, f } = useI18n();
  const p = t.plans;
  const [country, setCountry] = useState<PricingCountry>("Guinea");
  const [cycle, setCycle] = useState<BillingCycle>("monthly");

  const bandOf = (code: PlanCode) => f(p.band, { min: PLAN_BANDS[code].min, max: PLAN_BANDS[code].max });
  const nameOf = (code: PlanCode) => tierName(code, country, p.tiers[code].name);

  return (
    <section className={`${standalone ? "bg-white" : "bg-soft-50"} py-24`}>
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        {!standalone && (
          <SectionHeading eyebrow={p.eyebrow} title={p.title} subtitle={p.subtitle} />
        )}

        <div className={`${standalone ? "" : "mt-12"} flex flex-wrap items-start justify-center gap-8`}>
          <Toggle
            label={p.countryLabel}
            value={country}
            options={PRICING_COUNTRIES.map((c) => ({ value: c, label: p.countries[c] }))}
            onChange={setCountry}
          />
          <Toggle
            label={p.cycleLabel}
            value={cycle}
            options={[
              { value: "monthly" as const, label: p.monthly },
              { value: "annual" as const, label: p.annual, hint: p.annualSaving },
            ]}
            onChange={setCycle}
          />
        </div>

        <div className="mt-12 grid items-stretch gap-6 md:grid-cols-3">
          {PLAN_CODES.map((code) => {
            const tier = p.tiers[code];
            const price = priceFor(country, code, cycle);
            const highlighted = code === "growth";
            return (
              <div
                key={code}
                className={`relative flex flex-col rounded-3xl p-6 ${
                  highlighted
                    ? "bg-azure-800 text-white shadow-2xl shadow-azure-800/30"
                    : "border border-azure-800/10 bg-white"
                }`}
              >
                {highlighted && (
                  <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-soft-500 px-4 py-1 text-xs font-bold uppercase tracking-wide text-azure-800">
                    {p.mostPopular}
                  </span>
                )}
                <h3 className={`text-lg font-bold ${highlighted ? "text-soft-500" : "text-azure-800"}`}>
                  {nameOf(code)}
                </h3>
                <p className={`mt-1 text-xs font-semibold ${highlighted ? "text-white/70" : "text-onyx/50"}`}>
                  {bandOf(code)}
                </p>

                <div className="mt-5 min-h-[4.5rem]">
                  {price ? (
                    <>
                      <p className="text-[1.65rem] font-extrabold leading-none tracking-tight">
                        {formatMoney(price.amount, price.currency)}
                      </p>
                      <p className={`mt-1.5 text-sm ${highlighted ? "text-white/60" : "text-onyx/50"}`}>
                        {cycle === "annual" ? p.perYear : p.perMonth}
                      </p>
                    </>
                  ) : (
                    <p className="text-[1.65rem] font-extrabold leading-none tracking-tight">{p.quote}</p>
                  )}
                </div>

                <p className={`mt-4 flex-1 text-sm leading-relaxed ${highlighted ? "text-white/75" : "text-onyx/55"}`}>
                  {price ? tier.blurb : p.quoteBlurb}
                </p>

                <Link
                  href={path(`/signup?plan=${code}`)}
                  className={`mt-6 rounded-full py-2.5 text-center text-sm font-semibold transition ${
                    highlighted
                      ? "bg-soft-500 text-azure-800 hover:bg-soft-400"
                      : "bg-azure-800 text-white hover:bg-azure-900"
                  }`}
                >
                  {p.cta}
                </Link>
              </div>
            );
          })}
        </div>

        {/* One list, because it is one list: the tiers differ by size alone. */}
        <div className="mt-12 rounded-3xl border border-azure-800/10 bg-white p-8">
          <p className="text-center text-sm font-bold text-azure-800">{p.allIncluded}</p>
          <ul className="mt-5 grid gap-x-8 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
            {p.included.map((item) => (
              <li key={item} className="flex items-start gap-2.5 text-sm text-onyx/70">
                <span className="mt-0.5 text-azure-600"><CheckIcon className="h-4 w-4" /></span>
                {item}
              </li>
            ))}
          </ul>
        </div>

        {standalone && (
          <>
            <HowToPay />
            <PlanComparison country={country} cycle={cycle} />
          </>
        )}
      </div>
    </section>
  );
}

/** Three steps, because there is no card form yet and people will ask. */
function HowToPay() {
  const { t } = useI18n();
  const h = t.plans.howToPay;
  return (
    <div className="mt-16">
      <h3 className="text-center font-serif text-3xl font-medium tracking-tight text-azure-950">{h.title}</h3>
      <ol className="mt-8 grid gap-5 md:grid-cols-3">
        {h.steps.map((step, i) => (
          <li key={step} className="rounded-3xl border border-azure-800/10 bg-soft-50 p-6">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-azure-800 text-sm font-bold text-white">{i + 1}</span>
            <p className="mt-4 text-sm leading-relaxed text-onyx/70">{step}</p>
          </li>
        ))}
      </ol>
      <p className="mt-5 text-center text-sm text-onyx/45">{h.note}</p>
    </div>
  );
}

/** The same three tiers as a table, so the bands and both prices line up. */
export function PlanComparison({ country, cycle }: { country: PricingCountry; cycle: BillingCycle }) {
  const { t, path, f } = useI18n();
  const p = t.plans;
  const c = p.compare;

  const cell = (code: PlanCode, which: BillingCycle) => {
    const price = priceFor(country, code, which);
    return price ? formatMoney(price.amount, price.currency) : c.values.quote;
  };

  return (
    <div className="mt-20">
      <div className="text-center">
        <span className="inline-flex items-center gap-2 rounded-full bg-soft-50 px-4 py-1.5 text-sm font-semibold text-azure-800 shadow-sm shadow-azure-800/10">
          <span className="h-2 w-2 rounded-full bg-azure-600" />
          {c.badge}
        </span>
        <h2 className="mt-5 font-serif text-4xl font-medium tracking-tight text-azure-950">{c.title}</h2>
      </div>

      <div className="mt-12 overflow-x-auto rounded-[2rem] border border-azure-800/10 bg-white shadow-xl shadow-azure-800/10">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead>
            <tr>
              <th className="w-[22%] px-6 pb-4 pt-7 align-bottom text-xs font-semibold uppercase tracking-wider text-onyx/40">
                {c.whatYouGet}
              </th>
              {PLAN_CODES.map((code) => {
                const hi = code === "growth";
                return (
                  <th key={code} className={hi ? "bg-azure-800 px-4 pb-4 pt-6 align-bottom text-white" : "px-4 pb-4 pt-7 align-bottom"}>
                    {hi && (
                      <span className="mb-2 inline-block rounded-full bg-soft-500 px-3 py-0.5 text-[10px] font-bold uppercase tracking-wide text-azure-950">
                        {p.mostPopular}
                      </span>
                    )}
                    <p className={`text-base font-bold ${hi ? "" : "text-azure-950"}`}>{tierName(code, country, p.tiers[code].name)}</p>
                    <p className={`mt-0.5 text-xs font-medium ${hi ? "text-white/60" : "text-onyx/45"}`}>
                      {cell(code, cycle)}
                      {priceFor(country, code, cycle) && (
                        <span> {cycle === "annual" ? p.perYear : p.perMonth}</span>
                      )}
                    </p>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {[
              { label: c.rows.apartments, value: (code: PlanCode) => f(p.band, { min: PLAN_BANDS[code].min, max: PLAN_BANDS[code].max }) },
              { label: c.rows.monthly, value: (code: PlanCode) => cell(code, "monthly") },
              { label: c.rows.annual, value: (code: PlanCode) => cell(code, "annual") },
              { label: c.rows.everythingElse, value: () => c.values.included },
            ].map((row, i) => (
              <tr key={row.label} className={i % 2 === 0 ? "bg-soft-50/60" : ""}>
                <td className="px-6 py-4 font-semibold text-azure-950">{row.label}</td>
                {PLAN_CODES.map((code) => {
                  const v = row.value(code);
                  return (
                    <td key={code} className={`px-4 py-4 ${code === "growth" ? "bg-azure-800/[0.04] font-semibold text-azure-950" : "text-onyx/65"}`}>
                      {v === c.values.included ? (
                        <span className="grid h-7 w-7 place-items-center rounded-full bg-onyx text-white">
                          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M20 6L9 17l-5-5" />
                          </svg>
                        </span>
                      ) : v}
                    </td>
                  );
                })}
              </tr>
            ))}
            <tr>
              <td className="px-6 py-6" />
              {PLAN_CODES.map((code) => (
                <td key={code} className={code === "growth" ? "bg-azure-800/[0.04] px-4 py-6" : "px-4 py-6"}>
                  <Link
                    href={path(`/signup?plan=${code}`)}
                    className={
                      code === "growth"
                        ? "inline-block rounded-full bg-azure-800 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-azure-800/20 transition hover:bg-azure-900"
                        : "inline-block rounded-full border border-azure-800/20 px-4 py-2.5 text-sm font-semibold text-azure-800 transition hover:bg-soft-100"
                    }
                  >
                    {`${c.choose} ${tierName(code, country, p.tiers[code].name)}`}
                  </Link>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
      <p className="mt-6 text-center text-sm text-onyx/45">
        {c.note} {`${ANNUAL_MONTHS}/12`}
      </p>
    </div>
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
