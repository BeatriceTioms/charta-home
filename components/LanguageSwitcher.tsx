"use client";

import { usePathname, useRouter } from "next/navigation";
import { locales } from "@/lib/i18n";
import { useI18n } from "@/lib/i18n/context";

const LABELS: Record<string, string> = { fr: "FR", en: "EN" };

export function LanguageSwitcher({ tone = "light" }: { tone?: "light" | "dashboard" }) {
  const { locale, t } = useI18n();
  const pathname = usePathname();
  const router = useRouter();

  const switchTo = (next: string) => {
    if (next === locale) return;
    document.cookie = `charta-locale=${next};path=/;max-age=31536000;samesite=lax`;
    const rest = pathname.replace(/^\/(fr|en)/, "");
    router.push(`/${next}${rest || ""}`);
  };

  const wrapper =
    tone === "dashboard"
      ? "flex items-center rounded-full border border-azure-900/10 p-1 dark:border-white/10"
      : "flex items-center rounded-full bg-azure-900/5 p-1";

  return (
    <div className={wrapper} role="group" aria-label={t.nav.language}>
      {locales.map((l) => {
        const active = l === locale;
        return (
          <button
            key={l}
            onClick={() => switchTo(l)}
            aria-current={active}
            className={`rounded-full px-2.5 py-1 text-xs font-bold transition ${
              active
                ? "bg-onyx text-white dark:bg-soft-500 dark:text-azure-950"
                : "text-onyx/50 hover:text-azure-950 dark:text-white/50 dark:hover:text-white"
            }`}
          >
            {LABELS[l] ?? l.toUpperCase()}
          </button>
        );
      })}
    </div>
  );
}
