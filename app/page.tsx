import Image from "next/image";
import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import {
  ArrowIcon,
  CtaBanner,
  FaqSection,
  HowItWorksSection,
  PricingSection,
  ShowcaseSection,
  Stats,
} from "@/components/sections";

/* ---------- hero ---------- */

function HeroContent({ className = "" }: { className?: string }) {
  return (
    <div className={className}>
      <span className="inline-flex w-fit items-center gap-2 rounded-full border border-azure-800/10 bg-white/70 px-4 py-1.5 text-[13px] font-medium text-azure-800 backdrop-blur-sm">
        <span className="h-1.5 w-1.5 rounded-full bg-azure-600" />
        The trusted platform for real estate agencies
      </span>
      <h1 className="mt-6 font-serif text-4xl font-medium leading-[1.08] tracking-tight text-azure-950 sm:text-6xl lg:text-[64px]">
        Open the door to smarter property management
      </h1>
      <p className="mt-6 max-w-md text-lg leading-relaxed text-azure-900/70">
        Charta Home gives your agency complete clarity. The return on every
        building, rent collected on time, and maintenance handled gracefully
        over WhatsApp.
      </p>
      <div className="mt-9 flex flex-wrap items-center gap-5">
        <Link
          href="/signup"
          className="group flex items-center gap-3 rounded-full bg-azure-800 py-3.5 pl-7 pr-3.5 text-[15px] font-semibold text-white shadow-xl shadow-azure-800/25 transition hover:bg-azure-900"
        >
          Begin your free month
          <span className="grid h-8 w-8 place-items-center rounded-full bg-white text-azure-800 transition group-hover:translate-x-0.5">
            <ArrowIcon />
          </span>
        </Link>
        <Link
          href="/how-it-works"
          className="flex items-center gap-2.5 text-[15px] font-medium text-azure-900/80 transition hover:text-azure-800"
        >
          See how it works
          <span className="grid h-9 w-9 place-items-center rounded-full border border-azure-900/15 bg-white/60 backdrop-blur-sm">
            <svg viewBox="0 0 24 24" className="ml-0.5 h-3.5 w-3.5 fill-current">
              <path d="M8 5v14l11-7z" />
            </svg>
          </span>
        </Link>
      </div>
      <p className="mt-4 text-[13px] text-azure-900/50">
        One month on us · No credit card required
      </p>
    </div>
  );
}

function Hero() {
  return (
    <section className="bg-[#dfe6f4]">
      {/* small screens: text above, then the full image */}
      <div className="mx-auto max-w-7xl px-5 pb-4 pt-28 sm:px-8 lg:hidden">
        <HeroContent />
      </div>

      {/* the door render, shown in full */}
      <div className="relative">
        <Image
          src="/hero-door.png"
          alt="An elegant open door revealing a bright, beautifully kept apartment"
          width={1536}
          height={1024}
          priority
          className="h-auto max-h-[560px] w-full object-cover object-[center_35%] lg:max-h-[640px]"
        />

        {/* large screens: text over the image's open left side */}
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
        <HowItWorksSection compact />
        <PricingSection />
        <FaqSection limit={4} />
        <CtaBanner />
      </main>
      <Footer />
    </>
  );
}
