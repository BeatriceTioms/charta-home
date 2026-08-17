import type { MetadataRoute } from "next";
import { locales } from "@/lib/i18n";

const siteUrl = "https://chartahome.com";

/**
 * Only pages that are worth landing on. Login and the password screens carry a
 * noindex, so listing them here would contradict the pages themselves.
 */
const PAGES = [
  { path: "", priority: 1, changeFrequency: "weekly" as const },
  { path: "/features", priority: 0.9, changeFrequency: "monthly" as const },
  { path: "/pricing", priority: 0.9, changeFrequency: "monthly" as const },
  { path: "/signup", priority: 0.8, changeFrequency: "yearly" as const },
  { path: "/contact", priority: 0.6, changeFrequency: "yearly" as const },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return locales.flatMap((locale) =>
    PAGES.map((page) => ({
      url: `${siteUrl}/${locale}${page.path}`,
      lastModified,
      changeFrequency: page.changeFrequency,
      priority: page.priority,
      alternates: {
        languages: {
          ...Object.fromEntries(locales.map((l) => [l, `${siteUrl}/${l}${page.path}`])),
          "x-default": `${siteUrl}/fr${page.path}`,
        },
      },
    }))
  );
}
