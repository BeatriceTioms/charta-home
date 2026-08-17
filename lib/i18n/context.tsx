"use client";

import { createContext, useContext } from "react";
import { dictionaries, type Dictionary } from "./dictionaries";
import { defaultLocale, fill, type Locale } from "./index";

type I18nValue = {
  locale: Locale;
  t: Dictionary;
  /** Prefix a path with the active locale. */
  path: (p: string) => string;
  /** Fill {placeholders} in a translated string. */
  f: (template: string, values: Record<string, string | number>) => string;
  /** Translate a seed data string, falling back to the original. */
  s: (group: keyof Dictionary["seed"], value: string) => string;
};

const I18nContext = createContext<I18nValue>({
  locale: defaultLocale,
  t: dictionaries[defaultLocale],
  path: (p) => `/${defaultLocale}${p === "/" ? "" : p}`,
  f: fill,
  s: (_g, v) => v,
});

export function I18nProvider({
  locale,
  children,
}: {
  locale: Locale;
  children: React.ReactNode;
}) {
  const t = dictionaries[locale] ?? dictionaries[defaultLocale];

  const value: I18nValue = {
    locale,
    t,
    path: (p) => `/${locale}${p === "/" ? "" : p.startsWith("/") ? p : `/${p}`}`,
    f: fill,
    s: (group, raw) => {
      const table = t.seed[group] as unknown;
      if (table && typeof table === "object" && raw in (table as Record<string, string>)) {
        return (table as Record<string, string>)[raw];
      }
      return raw;
    },
  };

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  return useContext(I18nContext);
}
