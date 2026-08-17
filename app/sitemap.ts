import type { MetadataRoute } from "next";
import { locales } from "@/lib/i18n";

const siteUrl = "https://chartahome.com";

const PAGES = [
  { path: "", priority: 1, changeFrequency: "weekly" as const },
  { path: "/features", priority: 0.9, changeFrequency: "monthly" as const },
  { path: "/pricing", priority: 0.9, changeFrequency: "monthly" as const },
  { path: "/contact", priority: 0.6, changeFrequency: "yearly" as const },
  { path: "/signup", priority: 0.8, changeFrequency: "yearly" as const },
  { path: "/login", priority: 0.3, changeFrequency: "yearly" as const },
];

export default function sitemap(): MetadataRoute.Sitemap {
  return locales.flatMap((locale) =>
    PAGES.map((page) => ({
      url: `${siteUrl}/${locale}${page.path}`,
      changeFrequency: page.changeFrequency,
      priority: page.priority,
      alternates: {
        languages: Object.fromEntries(
          locales.map((l) => [l, `${siteUrl}/${l}${page.path}`])
        ),
      },
    }))
  );
}
