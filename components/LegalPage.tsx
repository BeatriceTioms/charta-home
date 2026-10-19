"use client";

import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { PageHero } from "@/components/sections";
import { useI18n } from "@/lib/i18n/context";
import { CONTACT_EMAIL, legalDoc, type LegalBlock, type LegalKey } from "@/lib/legal";

/** Turns the contact address inside legal text into a mailto link. */
function withEmail(text: string) {
  const parts = text.split(CONTACT_EMAIL);
  return parts.flatMap((part, i) =>
    i === 0
      ? [part]
      : [
          <a key={i} href={`mailto:${CONTACT_EMAIL}`} className="font-semibold text-azure-700 underline underline-offset-2">
            {CONTACT_EMAIL}
          </a>,
          part,
        ]
  );
}

function Block({ block }: { block: LegalBlock }) {
  if (typeof block === "string") {
    return <p className="text-[15px] leading-relaxed text-onyx/70">{withEmail(block)}</p>;
  }
  return (
    <ul className="space-y-2.5">
      {block.list.map((item) => (
        <li key={item} className="flex gap-3 text-[15px] leading-relaxed text-onyx/70">
          <span className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-azure-600" />
          <span>{withEmail(item)}</span>
        </li>
      ))}
    </ul>
  );
}

export function LegalPage({ doc: key }: { doc: LegalKey }) {
  const { locale, path } = useI18n();
  const doc = legalDoc(locale, key);
  const others: { key: LegalKey; href: string }[] = [
    { key: "privacy" as const, href: path("/privacy") },
    { key: "terms" as const, href: path("/terms") },
    { key: "deleteAccount" as const, href: path("/delete-account") },
  ].filter((o) => o.key !== key);

  return (
    <>
      <Navbar />
      <main>
        <PageHero eyebrow={doc.eyebrow} title={doc.title} subtitle={doc.subtitle} />

        <section className="bg-white py-16 sm:py-20">
          <div className="mx-auto grid max-w-6xl gap-12 px-5 sm:px-8 lg:grid-cols-[240px_1fr] lg:gap-16">
            <aside className="hidden lg:block">
              <nav className="sticky top-28 space-y-1 text-sm">
                {doc.sections.map((s) => (
                  <a key={s.id} href={`#${s.id}`} className="block rounded-xl px-3 py-2 text-onyx/55 transition hover:bg-soft-100 hover:text-azure-800">
                    {s.title}
                  </a>
                ))}
              </nav>
            </aside>

            <article className="min-w-0">
              <p className="text-sm font-semibold text-azure-600">{doc.updated}</p>
              <div className="mt-8 space-y-12">
                {doc.sections.map((s) => (
                  <section key={s.id} id={s.id} className="scroll-mt-28 space-y-4">
                    <h2 className="font-serif text-2xl font-medium text-azure-800 sm:text-[28px]">{s.title}</h2>
                    {s.body.map((b, i) => (
                      <Block key={i} block={b} />
                    ))}
                  </section>
                ))}
              </div>

              <div className="mt-16 flex flex-wrap gap-3 border-t border-azure-800/10 pt-8">
                {others.map((o) => (
                  <a key={o.key} href={o.href} className="rounded-full border border-azure-800/15 px-5 py-2.5 text-sm font-semibold text-azure-800 transition hover:bg-soft-100">
                    {legalDoc(locale, o.key).title}
                  </a>
                ))}
                <a href={`mailto:${CONTACT_EMAIL}`} className="rounded-full bg-azure-800 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-azure-900">
                  {CONTACT_EMAIL}
                </a>
              </div>
            </article>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
