import type { MetadataRoute } from "next";

const siteUrl = "https://chartahome.com";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${siteUrl}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${siteUrl}/features`, changeFrequency: "monthly", priority: 0.9 },
    { url: `${siteUrl}/pricing`, changeFrequency: "monthly", priority: 0.9 },
    { url: `${siteUrl}/contact`, changeFrequency: "yearly", priority: 0.6 },
    { url: `${siteUrl}/signup`, changeFrequency: "yearly", priority: 0.8 },
    { url: `${siteUrl}/login`, changeFrequency: "yearly", priority: 0.3 },
  ];
}
