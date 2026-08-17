import { dictionaries, type Dictionary } from "./dictionaries";

export const locales = ["fr", "en"] as const;
export type Locale = (typeof locales)[number];

/** French is Charta Home's primary language. */
export const defaultLocale: Locale = "fr";

export function isLocale(value: string): value is Locale {
  return (locales as readonly string[]).includes(value);
}

export function getDictionary(locale: string): Dictionary {
  return isLocale(locale) ? dictionaries[locale] : dictionaries[defaultLocale];
}

/** Build a locale prefixed path, e.g. href("fr", "/pricing") -> "/fr/pricing" */
export function href(locale: string, path: string) {
  const clean = path === "/" ? "" : path.startsWith("/") ? path : `/${path}`;
  return `/${locale}${clean}`;
}

/** Fill {placeholders} in a dictionary string. */
export function fill(template: string, values: Record<string, string | number>) {
  return template.replace(/\{(\w+)\}/g, (_, key) =>
    key in values ? String(values[key]) : `{${key}}`
  );
}

export type { Dictionary };
export { dictionaries };
