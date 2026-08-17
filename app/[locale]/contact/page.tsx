"use client";

import Image from "next/image";
import { useState } from "react";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { PageHero } from "@/components/sections";
import { useI18n } from "@/lib/i18n/context";

const inputCls =
  "w-full rounded-2xl border border-azure-800/15 bg-white px-4 py-3 text-[15px] text-onyx outline-none transition placeholder:text-onyx/30 focus:border-azure-600 focus:ring-4 focus:ring-azure-600/10";

export default function ContactPage() {
  const { t, path } = useI18n();
  const [sent, setSent] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const channels = [
    {
      title: t.contactPage.channels.email.title,
      value: "hello@chartahome.com",
      detail: t.contactPage.channels.email.detail,
      href: "mailto:hello@chartahome.com",
      icon: (
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="4" width="20" height="16" rx="3" /><path d="M22 7l-10 6L2 7" />
        </svg>
      ),
    },
    {
      title: t.contactPage.channels.whatsapp.title,
      value: t.contactPage.channels.whatsapp.value,
      detail: t.contactPage.channels.whatsapp.detail,
      href: "https://wa.me/224620000000",
      icon: (
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12a8.5 8.5 0 01-12.4 7.5L3 21l1.5-5.6A8.5 8.5 0 1121 12z" />
          <path d="M8.5 11h.01M12 11h.01M15.5 11h.01" strokeWidth="2.4" />
        </svg>
      ),
    },
    {
      title: t.contactPage.channels.demo.title,
      value: t.contactPage.channels.demo.value,
      detail: t.contactPage.channels.demo.detail,
      href: path("/signup"),
      icon: (
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="17" rx="3" /><path d="M8 2v4M16 2v4M3 10h18M9.5 15.5l2 2 3.5-3.5" />
        </svg>
      ),
    },
  ];

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const next: Record<string, string> = {};
    const name = String(data.get("name") ?? "").trim();
    const email = String(data.get("email") ?? "").trim();
    const message = String(data.get("message") ?? "").trim();

    if (!name) next.name = t.contactPage.form.errorRequired;
    if (!/^\S+@\S+\.\S+$/.test(email)) next.email = t.contactPage.form.errorEmail;
    if (!message) next.message = t.contactPage.form.errorRequired;

    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setSubmitting(true);
    setTimeout(() => {
      setSubmitting(false);
      setSent(true);
    }, 500);
  };

  return (
    <>
      <Navbar />
      <main>
        <PageHero
          eyebrow={t.contactPage.heroEyebrow}
          title={t.contactPage.heroTitle}
          subtitle={t.contactPage.heroSubtitle}
        />

        <section className="bg-white py-20">
          <div className="mx-auto grid max-w-7xl gap-10 px-5 sm:px-8 lg:grid-cols-[1fr_1.2fr] lg:gap-16">
            <div className="relative space-y-5">
              <div className="relative overflow-hidden rounded-3xl border border-white/60 shadow-xl shadow-azure-800/10">
                <Image
                  src="/photos/people-6.jpg"
                  alt=""
                  width={900}
                  height={506}
                  className="h-56 w-full object-cover object-[center_22%]"
                />
                <span className="absolute bottom-4 left-4 rounded-full bg-white/85 px-4 py-1.5 text-sm font-semibold text-azure-900 backdrop-blur-sm">
                  {t.contactPage.replyBadge}
                </span>
              </div>

              {channels.map((c) => (
                <a
                  key={c.title}
                  href={c.href}
                  target={c.href.startsWith("http") ? "_blank" : undefined}
                  rel={c.href.startsWith("http") ? "noopener noreferrer" : undefined}
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
                <p className="font-serif text-xl">{t.contactPage.locationTitle}</p>
                <p className="mt-1 text-sm text-white/65">{t.contactPage.locationValue}</p>
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
                    {t.contactPage.form.successTitle}
                  </h2>
                  <p className="mx-auto mt-3 max-w-sm text-onyx/55">
                    {t.contactPage.form.successBody}
                  </p>
                  <button
                    onClick={() => {
                      setSent(false);
                      setErrors({});
                    }}
                    className="mt-6 font-semibold text-azure-600 underline transition hover:text-azure-800"
                  >
                    {t.contactPage.form.sendAnother}
                  </button>
                </div>
              ) : (
                <form className="space-y-5" onSubmit={submit} noValidate>
                  <div className="grid gap-5 sm:grid-cols-2">
                    <label className="block">
                      <span className="mb-1.5 block text-sm font-semibold text-azure-800">
                        {t.contactPage.form.name}
                      </span>
                      <input
                        name="name"
                        placeholder={t.contactPage.form.namePlaceholder}
                        className={inputCls}
                      />
                      {errors.name && (
                        <span className="mt-1 block text-xs font-medium text-red-600">{errors.name}</span>
                      )}
                    </label>
                    <label className="block">
                      <span className="mb-1.5 block text-sm font-semibold text-azure-800">
                        {t.contactPage.form.email}
                      </span>
                      <input
                        name="email"
                        type="email"
                        placeholder={t.contactPage.form.emailPlaceholder}
                        className={inputCls}
                      />
                      {errors.email && (
                        <span className="mt-1 block text-xs font-medium text-red-600">{errors.email}</span>
                      )}
                    </label>
                  </div>
                  <label className="block">
                    <span className="mb-1.5 block text-sm font-semibold text-azure-800">
                      {t.contactPage.form.subject}
                    </span>
                    <select name="subject" className={inputCls} defaultValue="trial">
                      <option value="trial">{t.contactPage.form.subjects.trial}</option>
                      <option value="portfolio">{t.contactPage.form.subjects.portfolio}</option>
                      <option value="support">{t.contactPage.form.subjects.support}</option>
                      <option value="partnership">{t.contactPage.form.subjects.partnership}</option>
                      <option value="other">{t.contactPage.form.subjects.other}</option>
                    </select>
                  </label>
                  <label className="block">
                    <span className="mb-1.5 block text-sm font-semibold text-azure-800">
                      {t.contactPage.form.message}
                    </span>
                    <textarea
                      name="message"
                      rows={5}
                      placeholder={t.contactPage.form.messagePlaceholder}
                      className={`${inputCls} resize-none`}
                    />
                    {errors.message && (
                      <span className="mt-1 block text-xs font-medium text-red-600">{errors.message}</span>
                    )}
                  </label>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full rounded-full bg-azure-800 py-3.5 text-[15px] font-semibold text-white shadow-lg shadow-azure-800/20 transition hover:bg-azure-900 disabled:opacity-60"
                  >
                    {submitting ? t.dash.common.saving : t.contactPage.form.submit}
                  </button>
                  <p className="text-center text-xs text-onyx/45">{t.contactPage.form.note}</p>
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
