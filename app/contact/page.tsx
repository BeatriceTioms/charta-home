"use client";

import { useState } from "react";
import Image from "next/image";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { PageHero } from "@/components/sections";

const inputCls =
  "w-full rounded-2xl border border-azure-800/15 bg-white px-4 py-3 text-[15px] text-onyx outline-none transition placeholder:text-onyx/30 focus:border-azure-600 focus:ring-4 focus:ring-azure-600/10";

const CHANNELS = [
  {
    title: "Email",
    value: "hello@chartahome.com",
    detail: "A person, not a bot, answers within the day.",
    href: "mailto:hello@chartahome.com",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="4" width="20" height="16" rx="3" /><path d="M22 7l-10 6L2 7" />
      </svg>
    ),
  },
  {
    title: "WhatsApp",
    value: "+224 620 00 00 00",
    detail: "The channel we know best. Weekdays, 9 to 6.",
    href: "https://wa.me/224620000000",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 12a8.5 8.5 0 01-12.4 7.5L3 21l1.5-5.6A8.5 8.5 0 1121 12z" />
        <path d="M8.5 11h.01M12 11h.01M15.5 11h.01" strokeWidth="2.4" />
      </svg>
    ),
  },
  {
    title: "Book a walkthrough",
    value: "30 minutes, on us",
    detail: "See your own portfolio inside Charta Home.",
    href: "/signup",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="17" rx="3" /><path d="M8 2v4M16 2v4M3 10h18M9.5 15.5l2 2 3.5-3.5" />
      </svg>
    ),
  },
];

export default function ContactPage() {
  const [sent, setSent] = useState(false);

  return (
    <>
      <Navbar />
      <main>
        <PageHero
          eyebrow="Contact"
          title="Talk to a real person"
          subtitle="Questions about the trial, a large portfolio, or something particular to your agency. Write to us and we will reply within the day."
        />

        <section className="bg-white py-20">
          <div className="mx-auto grid max-w-7xl gap-10 px-5 sm:px-8 lg:grid-cols-[1fr_1.2fr] lg:gap-16">
            {/* channels */}
            <div className="relative space-y-5">
              <div className="relative overflow-hidden rounded-3xl border border-white/60 shadow-xl shadow-azure-800/10">
                <Image
                  src="/photos/people-6.jpg"
                  alt="A member of the Charta Home team in Conakry"
                  width={900}
                  height={506}
                  className="h-56 w-full object-cover object-[center_22%]"
                />
                <span className="absolute bottom-4 left-4 rounded-full bg-white/85 px-4 py-1.5 text-sm font-semibold text-azure-900 backdrop-blur-sm">
                  We reply within the day
                </span>
              </div>
              {CHANNELS.map((c) => (
                <a
                  key={c.title}
                  href={c.href}
                  className="relative flex items-start gap-4 rounded-3xl border border-white/60 bg-white/30 p-6 shadow-lg shadow-azure-800/5 backdrop-blur-xl transition hover:bg-white/50"
                >
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-azure-800/80 text-white backdrop-blur-sm">
                    {c.icon}
                  </span>
                  <div>
                    <h2 className="font-bold text-azure-800">{c.title}</h2>
                    <p className="mt-0.5 text-[15px] font-semibold text-onyx/75">{c.value}</p>
                    <p className="mt-1 text-sm text-onyx/50">{c.detail}</p>
                  </div>
                </a>
              ))}
              <div className="relative rounded-3xl bg-azure-800 p-6 text-white">
                <p className="font-serif text-xl">Location</p>
                <p className="mt-1 text-sm text-white/65">
                  Conakry, Republic of Guinea
                </p>
              </div>
            </div>

            {/* form */}
            <div className="rounded-3xl border border-azure-800/10 bg-white p-8 shadow-xl shadow-azure-800/5">
              {sent ? (
                <div className="py-10 text-center">
                  <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-soft-200 text-azure-800">
                    <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                  </span>
                  <h2 className="mt-5 font-serif text-3xl font-medium text-azure-800">
                    Message received
                  </h2>
                  <p className="mx-auto mt-3 max-w-sm text-onyx/55">
                    Thank you for writing. A member of our team will reply to
                    you within the day.
                  </p>
                  <button
                    onClick={() => setSent(false)}
                    className="mt-6 font-semibold text-azure-600 underline transition hover:text-azure-800"
                  >
                    Send another message
                  </button>
                </div>
              ) : (
                <form
                  className="space-y-5"
                  onSubmit={(e) => {
                    e.preventDefault();
                    setSent(true);
                  }}
                >
                  <div className="grid gap-5 sm:grid-cols-2">
                    <label className="block">
                      <span className="mb-1.5 block text-sm font-semibold text-azure-800">Full name</span>
                      <input name="name" required placeholder="Amina Sow" className={inputCls} />
                    </label>
                    <label className="block">
                      <span className="mb-1.5 block text-sm font-semibold text-azure-800">Work email</span>
                      <input name="email" type="email" required placeholder="you@agency.com" className={inputCls} />
                    </label>
                  </div>
                  <label className="block">
                    <span className="mb-1.5 block text-sm font-semibold text-azure-800">Subject</span>
                    <select name="subject" className={inputCls} defaultValue="trial">
                      <option value="trial">The free month and pricing</option>
                      <option value="portfolio">A large portfolio</option>
                      <option value="support">Support for my account</option>
                      <option value="partnership">Partnership</option>
                      <option value="other">Something else</option>
                    </select>
                  </label>
                  <label className="block">
                    <span className="mb-1.5 block text-sm font-semibold text-azure-800">Message</span>
                    <textarea
                      name="message"
                      required
                      rows={5}
                      placeholder="Tell us about your agency and what you need."
                      className={`${inputCls} resize-none`}
                    />
                  </label>
                  <button
                    type="submit"
                    className="w-full rounded-full bg-azure-800 py-3.5 text-[15px] font-semibold text-white shadow-lg shadow-azure-800/20 transition hover:bg-azure-900"
                  >
                    Send message
                  </button>
                  <p className="text-center text-xs text-onyx/45">
                    We reply within one business day. Your details are never shared.
                  </p>
                </form>
              )}
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
