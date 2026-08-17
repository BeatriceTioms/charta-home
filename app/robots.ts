import type { MetadataRoute } from "next";

const siteUrl = "https://chartahome.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/fr/dashboard", "/en/dashboard", "/dashboard", "/api/"],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
