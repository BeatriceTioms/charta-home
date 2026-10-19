import type { Metadata } from "next";
import { getDictionary, locales } from "@/lib/i18n";

export const siteUrl = "https://chartahome.com";

/** The social card. Declared once so every page shares the same image. */
const ogImage = {
  url: "/hero-door.png",
  width: 1536,
  height: 1024,
  alt: "Charta Home",
};

type MetaKey = "features" | "pricing" | "contact" | "login" | "signup" | "forgot" | "reset";

/**
 * Metadata for a marketing page.
 *
 * Each page needs its own canonical. Without one every page inherits the home
 * page's, which tells a search engine they are all duplicates of the home page
 * and should be dropped from the index.
 *
 * Pass `index: false` for pages that exist only for people who already have an
 * account. They are useless in results and dilute the pages that matter.
 */
export function pageMetadata(
  locale: string,
  key: MetaKey | { title: string; description: string },
  path: string,
  { index = true }: { index?: boolean } = {}
): Metadata {
  const meta = typeof key === "string" ? getDictionary(locale).meta[key] : key;

  return {
    title: meta.title,
    description: meta.description,
    alternates: {
      canonical: `/${locale}${path}`,
      languages: {
        ...Object.fromEntries(locales.map((l) => [l, `/${l}${path}`])),
        "x-default": `/fr${path}`,
      },
    },
    openGraph: {
      type: "website",
      url: `${siteUrl}/${locale}${path}`,
      siteName: "Charta Home",
      locale: locale === "fr" ? "fr_GN" : "en_US",
      title: meta.title,
      description: meta.description,
      images: [ogImage],
    },
    twitter: {
      card: "summary_large_image",
      title: meta.title,
      description: meta.description,
      images: [ogImage.url],
    },
    robots: index
      ? {
          index: true,
          follow: true,
          googleBot: {
            index: true,
            follow: true,
            "max-image-preview": "large",
            "max-snippet": -1,
          },
        }
      : { index: false, follow: true },
  };
}
