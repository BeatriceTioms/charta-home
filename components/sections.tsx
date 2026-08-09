import Image from "next/image";
import Link from "next/link";
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

/* Header used at the top of every dedicated page */
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

export type ShowcaseRow = {
  eyebrow: string;
  title: string;
  description: string;
  points?: string[];
  image: string;
  imageAlt: string;
};

export function ImageTextRows({ rows }: { rows: ShowcaseRow[] }) {
  return (
    <div className="mx-auto max-w-7xl space-y-20 px-5 sm:px-8 lg:space-y-28">
      {rows.map((row, i) => (
        <div
          key={row.title}
          className={`grid items-center gap-10 lg:grid-cols-2 lg:gap-16 ${
            i % 2 === 1 ? "lg:[&>*:first-child]:order-2" : ""
          }`}
        >
          <div className="relative overflow-hidden rounded-[2rem] shadow-2xl shadow-azure-800/15">
            <Image
              src={row.image}
              alt={row.imageAlt}
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
            {row.points && (
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
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

const HOME_SHOWCASE: ShowcaseRow[] = [
  {
    eyebrow: "Return on investment",
    title: "Know what every building truly earns",
    description:
      "Income, expenses, and net yield for each building and each apartment. You will always know which properties perform, and which quietly erode your margin.",
    points: [
      "Net yield per apartment, building, and portfolio",
      "Occupancy and vacancy cost, always current",
      "Elegant statements for the owners you represent",
    ],
    image: "/photos/building-1.jpg",
    imageAlt: "A modern apartment building at dusk",
  },
  {
    eyebrow: "Rent, on time",
    title: "Reminders that collect without chasing",
    description:
      "Courteous reminders go out before rent is due, and measured follow ups after. Over WhatsApp, SMS, or email, your tenants are treated with courtesy and your cash flow with respect.",
    points: [
      "Scheduled reminders in your agency's tone",
      "Tactful escalation when payment runs late",
      "Receipts and payment history on every lease",
    ],
    image: "/photos/interior-2.jpg",
    imageAlt: "A bright, well kept apartment living room",
  },
  {
    eyebrow: "Maintenance",
    title: "Issues reported and resolved over WhatsApp",
    description:
      "Tenants message a number they already have. Each message becomes a tracked ticket your team assigns and follows, while the tenant stays informed until the work is confirmed done.",
    points: [
      "No apps for tenants to install",
      "Assignment, status, and history on every ticket",
      "Resolution times reflected in building ROI",
    ],
    image: "/photos/interior-3.jpg",
    imageAlt: "A cared for modern interior",
  },
];

export function ShowcaseSection() {
  return (
    <section className="bg-white py-24">
      <div className="mb-16">
        <SectionHeading
          eyebrow="Everything in its place"
          title="Your whole portfolio, handled with care"
          subtitle="Whether you manage one building or fifty, Charta Home keeps money, tenants, and maintenance impeccably under control."
        />
      </div>
      <ImageTextRows rows={HOME_SHOWCASE} />
      <div className="mt-14 text-center">
        <Link
          href="/features"
          className="inline-flex items-center gap-2 font-semibold text-azure-600 transition hover:text-azure-800"
        >
          Explore all features <ArrowIcon />
        </Link>
      </div>
    </section>
  );
}

/* ---------- stats ---------- */

export function Stats() {
  const stats = [
    { value: "12,000+", label: "apartments under management" },
    { value: "96%", label: "of rent collected on time" },
    { value: "2.4×", label: "faster maintenance resolution" },
    { value: "400+", label: "agencies place their trust in us" },
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

/* ---------- features ---------- */

export const FEATURES = [
  {
    title: "ROI on every building",
    description:
      "Income, expenses, and net yield for each building and each apartment. You will always know which properties perform, and which quietly erode your margin.",
    icon: (
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 21h18M5 21V10l7-6 7 6v11M9 21v-6h6v6" />
      </svg>
    ),
  },
  {
    title: "Smart payment reminders",
    description:
      "Courteous reminders at just the right moment, before and after rent is due, with measured escalation for late payers. Your team never has to chase.",
    icon: (
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 01-3.4 0" />
      </svg>
    ),
  },
  {
    title: "Maintenance over WhatsApp",
    description:
      "Tenants report issues on the channel they already use. Every request becomes a tracked ticket, assigned, resolved, and confirmed back to the tenant automatically.",
    icon: (
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 12a8.5 8.5 0 01-12.4 7.5L3 21l1.5-5.6A8.5 8.5 0 1121 12z" />
        <path d="M8.5 11h.01M12 11h.01M15.5 11h.01" strokeWidth="2.4" />
      </svg>
    ),
  },
  {
    title: "Leases and tenants, organized",
    description:
      "Monthly or yearly leases, deposits, renewals, and complete tenant records for every unit, across one building or an entire portfolio.",
    icon: (
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8zM14 2v6h6M9 13h6M9 17h4" />
      </svg>
    ),
  },
  {
    title: "Owner reporting",
    description:
      "Elegant monthly statements for the owners you represent. Income, costs, and occupancy, presented with the polish your agency is known for.",
    icon: (
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 20V10M10 20V4M16 20v-8M2 20h20" />
      </svg>
    ),
  },
  {
    title: "A team that works as one",
    description:
      "Invite colleagues with precisely the right level of access, from full partners to caretakers who only see their building.",
    icon: (
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
      </svg>
    ),
  },
];

export function FeatureCard({ feature }: { feature: (typeof FEATURES)[number] }) {
  return (
    <div className="group rounded-3xl border border-azure-800/8 bg-soft-50 p-8 transition hover:border-azure-800/20 hover:shadow-xl hover:shadow-azure-800/5">
      <span className="grid h-12 w-12 place-items-center rounded-2xl bg-azure-800 text-soft-500 transition group-hover:scale-105">
        {feature.icon}
      </span>
      <h3 className="mt-5 text-xl font-bold text-azure-800">{feature.title}</h3>
      <p className="mt-2.5 leading-relaxed text-onyx/60">{feature.description}</p>
    </div>
  );
}

/* ---------- how it works ---------- */

export const STEPS = [
  {
    n: "01",
    title: "Create your agency workspace",
    description:
      "Set up your agency in minutes. Your name, your team, your branding on every owner report.",
  },
  {
    n: "02",
    title: "Add your buildings",
    description:
      "Register each building and its apartments, with rent amounts, charges, and the owners you represent.",
  },
  {
    n: "03",
    title: "Onboard tenants and leases",
    description:
      "Attach tenants to units with monthly or yearly leases. Reminders and WhatsApp maintenance switch on automatically.",
  },
  {
    n: "04",
    title: "Let the reminders work",
    description:
      "Rent reminders go out at exactly the right moment, in exactly the right tone. Late payments receive measured follow up.",
  },
  {
    n: "05",
    title: "Review your returns",
    description:
      "Your dashboard shows the true ROI of every building, so every renewal, renovation, and acquisition is an informed decision.",
  },
];

export function HowItWorksSection({ compact = false }: { compact?: boolean }) {
  const steps = compact ? [STEPS[1], STEPS[2], STEPS[4]] : STEPS;
  return (
    <section className="bg-azure-800 py-24 text-white">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <SectionHeading
          dark
          eyebrow="How it works"
          title="Up and running in an afternoon"
          subtitle="No consultants, no lengthy onboarding. Your portfolio, organized before the day ends."
        />
        <div className={`mt-14 grid gap-6 ${compact ? "md:grid-cols-3" : "md:grid-cols-2 lg:grid-cols-3"}`}>
          {steps.map((s) => (
            <div key={s.n} className="rounded-3xl border border-white/10 bg-white/5 p-8">
              <span className="font-serif text-5xl font-medium text-soft-500/60">{s.n}</span>
              <h3 className="mt-4 text-xl font-bold">{s.title}</h3>
              <p className="mt-2.5 leading-relaxed text-white/65">{s.description}</p>
            </div>
          ))}
        </div>
        {compact && (
          <div className="mt-10 text-center">
            <Link
              href="/features#journey"
              className="inline-flex items-center gap-2 font-semibold text-soft-500 transition hover:text-white"
            >
              See the full journey <ArrowIcon />
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}

/* ---------- pricing ---------- */

export const PLANS = [
  {
    name: "Starter",
    price: 29,
    blurb: "For agencies beginning with a single building.",
    features: [
      "1 building · up to 20 apartments",
      "ROI dashboard",
      "Email payment reminders",
      "Tenant and lease records",
      "1 team member",
    ],
    highlighted: false,
  },
  {
    name: "Growth",
    price: 79,
    blurb: "For growing agencies managing several buildings.",
    features: [
      "Up to 5 buildings · 150 apartments",
      "ROI dashboard with analytics per unit",
      "WhatsApp, SMS, and email reminders",
      "Maintenance tracking over WhatsApp",
      "Owner reports",
      "5 team members",
    ],
    highlighted: true,
  },
  {
    name: "Agency",
    price: 199,
    blurb: "For established agencies with a distinguished portfolio.",
    features: [
      "Unlimited buildings and apartments",
      "Advanced ROI and owner reporting",
      "All smart reminders plus escalations",
      "Priority WhatsApp maintenance flows",
      "Unlimited team members",
      "Dedicated support",
    ],
    highlighted: false,
  },
];

export function PricingSection({ standalone = false }: { standalone?: boolean }) {
  return (
    <section className={`${standalone ? "bg-white" : "bg-soft-50"} py-24`}>
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        {!standalone && (
          <SectionHeading
            eyebrow="Pricing"
            title="Simple plans, priced monthly"
            subtitle="Every plan begins with a full month on us. Every feature, no credit card, no obligation."
          />
        )}
        <div className={`${standalone ? "" : "mt-14"} grid items-stretch gap-6 lg:grid-cols-3`}>
          {PLANS.map((p) => (
            <div
              key={p.name}
              className={`relative flex flex-col rounded-3xl p-8 ${
                p.highlighted
                  ? "bg-azure-800 text-white shadow-2xl shadow-azure-800/30 lg:-my-4 lg:py-12"
                  : "border border-azure-800/10 bg-white"
              }`}
            >
              {p.highlighted && (
                <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-soft-500 px-4 py-1 text-xs font-bold uppercase tracking-wide text-azure-800">
                  Most popular
                </span>
              )}
              <h3 className={`text-lg font-bold ${p.highlighted ? "text-soft-500" : "text-azure-800"}`}>
                {p.name}
              </h3>
              <div className="mt-3 flex items-end gap-1.5">
                <span className="text-5xl font-extrabold tracking-tight">${p.price}</span>
                <span className={`mb-1.5 text-sm ${p.highlighted ? "text-white/60" : "text-onyx/50"}`}>
                  / month
                </span>
              </div>
              <p className={`mt-2.5 text-sm leading-relaxed ${p.highlighted ? "text-white/70" : "text-onyx/55"}`}>
                {p.blurb}
              </p>
              <ul className="mt-6 flex-1 space-y-3">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm">
                    <span className={`mt-0.5 ${p.highlighted ? "text-soft-500" : "text-azure-600"}`}>
                      <CheckIcon className="h-4 w-4" />
                    </span>
                    <span className={p.highlighted ? "text-white/85" : "text-onyx/70"}>{f}</span>
                  </li>
                ))}
              </ul>
              <Link
                href="/signup"
                className={`mt-8 rounded-full py-3 text-center text-[15px] font-semibold transition ${
                  p.highlighted
                    ? "bg-soft-500 text-azure-800 hover:bg-soft-400"
                    : "bg-azure-800 text-white hover:bg-azure-900"
                }`}
              >
                Begin your free month
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------- faq ---------- */

export const FAQS = [
  {
    q: "How does the free first month work?",
    a: "Create your account, add your buildings, and use every feature of your chosen plan free for 30 days. No credit card is required. You only pay if you decide Charta Home has earned its place in your agency.",
  },
  {
    q: "How do WhatsApp maintenance requests work?",
    a: "Each building has a WhatsApp contact your tenants can message. Requests are logged automatically as tickets in Charta Home, where your team assigns, tracks, and closes them, and the tenant receives status updates back on WhatsApp.",
  },
  {
    q: "Can I manage both monthly and yearly leases?",
    a: "Yes. Each lease carries its own cycle, rent amount, and due dates. Payment reminders adapt automatically to the schedule.",
  },
  {
    q: "How is ROI calculated?",
    a: "Charta Home sets rent collected against each building's expenses, including maintenance, charges, and vacancies, to show net yield per apartment, per building, and across your whole portfolio.",
  },
  {
    q: "Is my data secure?",
    a: "Your data is encrypted in transit and at rest, backed up daily, and never shared or sold. Your portfolio's information belongs to your agency alone, and you can export it at any time.",
  },
  {
    q: "Can I switch plans later?",
    a: "At any time. Upgrade or downgrade from your billing settings and the change applies to your next monthly invoice.",
  },
  {
    q: "Do the owners I represent get access?",
    a: "On Growth and Agency plans you can share elegant monthly reports with owners, covering income, costs, and occupancy, without giving them access to your internal operations.",
  },
  {
    q: "What happens after the free month?",
    a: "We ask you to choose a plan before your trial ends. If you decide not to continue, your data remains exportable for 90 days. No lock in, no fine print.",
  },
];

export function FaqSection({ limit, standalone = false }: { limit?: number; standalone?: boolean }) {
  const faqs = limit ? FAQS.slice(0, limit) : FAQS;
  return (
    <section className="bg-white py-24">
      <div className="mx-auto max-w-3xl px-5 sm:px-8">
        {!standalone && (
          <SectionHeading eyebrow="FAQ" title="Questions, answered" />
        )}
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
              href="/pricing#faq"
              className="inline-flex items-center gap-2 font-semibold text-azure-600 transition hover:text-azure-800"
            >
              Read all questions <ArrowIcon />
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}

/* ---------- cta ---------- */

export function CtaBanner() {
  return (
    <section className="bg-white pb-24 pt-4">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="relative overflow-hidden rounded-[2.5rem] bg-onyx px-8 py-16 text-center text-white sm:px-16">
          <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-soft-500/15 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-20 -left-16 h-64 w-64 rounded-full bg-azure-600/25 blur-3xl" />
          <div className="relative mx-auto flex max-w-2xl flex-col items-center">
            <LogoMark className="h-14 w-14" color="#ffffff" door="#020202" />
            <h2 className="mt-6 font-serif text-4xl font-medium tracking-tight sm:text-5xl">
              Ready to open the door?
            </h2>
            <p className="mt-4 text-lg text-white/70">
              Join 400+ agencies who run their portfolio on Charta Home. Your
              first month is on us.
            </p>
            <Link
              href="/signup"
              className="mt-8 rounded-full bg-soft-500 px-8 py-3.5 text-[15px] font-bold text-azure-900 transition hover:bg-soft-400"
            >
              Begin your free month
            </Link>
            <p className="mt-4 text-sm text-white/50">
              No credit card required · Cancel anytime · Your data stays yours
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
