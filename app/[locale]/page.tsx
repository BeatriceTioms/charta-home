"use client";

import Image from "next/image";
import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import {
  ArrowIcon,
  CtaBanner,
  HowItWorksSection,
  PricingSection,
  ShowcaseSection,
  Stats,
} from "@/components/sections";
import { useI18n } from "@/lib/i18n/context";

function HeroContent({ className = "" }: { className?: string }) {
  const { t, path } = useI18n();
  return (
    <div className={className}>
      <span className="inline-flex w-fit items-center gap-2 rounded-full border border-azure-800/10 bg-white/70 px-4 py-1.5 text-[13px] font-medium text-azure-800 backdrop-blur-sm">
        <span className="h-1.5 w-1.5 rounded-full bg-azure-600" />
        {t.hero.badge}
      </span>
      <h1 className="mt-6 font-serif text-4xl font-medium leading-[1.08] tracking-tight text-azure-950 sm:text-6xl lg:text-[64px]">
        {t.hero.titleBefore}{" "}
        <span className="bg-gradient-to-r from-azure-800 via-azure-600 to-[#5ab5dc] bg-clip-text text-transparent">
          {t.hero.titleAccent}
        </span>{" "}
        {t.hero.titleAfter}
      </h1>
      <p className="mt-6 max-w-md text-lg leading-relaxed text-azure-900/70">
        {t.hero.subtitle}
      </p>
      <div className="mt-9 flex flex-wrap items-center gap-5">
        <Link
          href={path("/signup")}
          className="group flex items-center gap-3 rounded-full bg-azure-800 py-3.5 pl-7 pr-3.5 text-[15px] font-semibold text-white shadow-xl shadow-azure-800/25 transition hover:bg-azure-900"
        >
          {t.hero.cta}
          <span className="grid h-8 w-8 place-items-center rounded-full bg-white text-azure-800 transition group-hover:translate-x-0.5">
            <ArrowIcon />
          </span>
        </Link>
        <Link
          href={path("/features#journey")}
          className="flex items-center gap-2.5 text-[15px] font-medium text-azure-900/80 transition hover:text-azure-800"
        >
          {t.hero.secondary}
          <span className="grid h-9 w-9 place-items-center rounded-full border border-azure-900/15 bg-white/60 backdrop-blur-sm">
            <svg viewBox="0 0 24 24" className="ml-0.5 h-3.5 w-3.5 fill-current">
              <path d="M8 5v14l11-7z" />
            </svg>
          </span>
        </Link>
      </div>
      <p className="mt-4 text-[13px] text-azure-900/50">{t.hero.note}</p>
    </div>
  );
}

function Hero() {
  const { t } = useI18n();
  return (
    <section className="bg-[#dfe6f4]">
      <div className="mx-auto max-w-7xl px-5 pb-4 pt-28 sm:px-8 lg:hidden">
        <HeroContent />
      </div>

      <div className="relative">
        <Image
          src="/hero-door.png"
          alt={t.hero.badge}
          width={1536}
          height={1024}
          priority
          className="h-auto max-h-[820px] w-full object-cover object-[center_35%] lg:max-h-[960px]"
        />

        {/* cloud fade into the stats section */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-white via-white/60 to-transparent lg:h-56" />

        <div className="absolute inset-0 hidden items-center lg:flex">
          <div className="mx-auto w-full max-w-7xl px-5 sm:px-8">
            <HeroContent className="max-w-xl pt-14" />
          </div>
        </div>
      </div>
    </section>
  );
}

export default function Home() {
  return (
    <>
      <Navbar transparent />
      <main>
        <Hero />
        <Stats />
        <ShowcaseSection />
        <HowItWorksSection />
        <PricingSection />
        <CtaBanner />
      </main>
      <Footer />
    </>
  );
}
