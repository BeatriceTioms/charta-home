import type { MetadataRoute } from "next";

/**
 * Lets an agency keep Charta Home on a phone home screen, which matters in
 * Conakry where most of the day happens on mobile.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Charta Home",
    short_name: "Charta",
    description:
      "Logiciel de gestion immobilière pour agences: rendement, encaissement des loyers et maintenance.",
    start_url: "/fr",
    display: "standalone",
    background_color: "#003152",
    theme_color: "#003152",
    lang: "fr",
    categories: ["business", "productivity", "finance"],
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}
