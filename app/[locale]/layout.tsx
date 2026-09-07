import type { Metadata } from "next";
import { PLAN_CODES, PRICING_COUNTRIES, priceFor, tierName } from "@/lib/pricing";
import { notFound } from "next/navigation";
import { getDictionary, isLocale, locales } from "@/lib/i18n";
import { I18nProvider } from "@/lib/i18n/context";
import { RecoveryRedirect } from "@/components/auth/RecoveryRedirect";

const siteUrl = "https://chartahome.com";

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = getDictionary(locale);

  return {
    metadataBase: new URL(siteUrl),
    title: {
      default: t.meta.home.title,
      template: `%s | Charta Home`,
    },
    description: t.meta.home.description,
    applicationName: "Charta Home",
    keywords:
      locale === "fr"
        ? [
            "logiciel de gestion immobilière",
            "gestion locative",
            "gestion locative Conakry",
            "gestion immobilière Guinée",
            "encaissement des loyers",
            "rappels de loyer WhatsApp",
            "rendement immobilier",
            "logiciel agence immobilière",
            "suivi de maintenance",
            "Charta Home",
          ]
        : [
            "property management software",
            "real estate agency software",
            "rent collection software",
            "WhatsApp rent reminders",
            "building ROI tracking",
            "property management Guinea",
            "property management Conakry",
            "Charta Home",
          ],
    authors: [{ name: "Charta Home", url: siteUrl }],
    creator: "Charta Home",
    publisher: "Charta Home",
    category: locale === "fr" ? "Logiciel immobilier" : "Real estate software",
    alternates: {
      canonical: `/${locale}`,
      languages: {
        fr: "/fr",
        en: "/en",
        "x-default": "/fr",
      },
    },
    openGraph: {
      type: "website",
      url: `${siteUrl}/${locale}`,
      siteName: "Charta Home",
      locale: locale === "fr" ? "fr_GN" : "en_US",
      title: t.meta.home.title,
      description: t.meta.home.description,
      images: [
        {
          url: "/hero-door.png",
          width: 1536,
          height: 1024,
          alt: t.hero.badge,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: t.meta.home.title,
      description: t.meta.home.description,
      images: ["/hero-door.png"],
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-image-preview": "large",
        "max-snippet": -1,
        "max-video-preview": -1,
      },
    },
  };
}

function structuredData(locale: string) {
  const t = getDictionary(locale);
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${siteUrl}/#organization`,
        name: "Charta Home",
        url: siteUrl,
        email: "hello@chartahome.com",
        description: t.meta.home.description,
        address: {
          "@type": "PostalAddress",
          addressLocality: "Conakry",
          addressCountry: "GN",
        },
        contactPoint: {
          "@type": "ContactPoint",
          contactType: "customer service",
          email: "hello@chartahome.com",
          telephone: "+224620000000",
          availableLanguage: ["French", "English"],
        },
      },
      {
        "@type": "WebSite",
        "@id": `${siteUrl}/#website`,
        url: `${siteUrl}/${locale}`,
        name: "Charta Home",
        inLanguage: locale === "fr" ? "fr-GN" : "en",
        publisher: { "@id": `${siteUrl}/#organization` },
      },
      {
        "@type": "SoftwareApplication",
        "@id": `${siteUrl}/#software`,
        name: "Charta Home",
        url: siteUrl,
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",
        inLanguage: locale === "fr" ? "fr-GN" : "en",
        description: t.meta.home.description,
        // One offer per tier and country, in the currency it is sold in.
        // Enterprise has no number and so no offer.
        offers: PRICING_COUNTRIES.flatMap((country) =>
          PLAN_CODES.flatMap((code) => {
            const price = priceFor(country, code, "monthly");
            if (!price) return [];
            return [{
              "@type": "Offer",
              name: `${tierName(code, country, t.plans.tiers[code].name)} · ${country}`,
              price: String(price.amount),
              priceCurrency: price.currency,
              description: t.plans.tiers[code].blurb,
            }];
          })
        ),
      },
    ],
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Lora:ital,wght@0,400;0,500;0,600;1,400&family=Caveat:wght@600;700&display=swap"
          rel="stylesheet"
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData(locale)) }}
        />
      </head>
      <body>
        <I18nProvider locale={locale}>
          {/* An invitation token can land on any page; this carries it home. */}
          <RecoveryRedirect />
          {children}
        </I18nProvider>
      </body>
    </html>
  );
}
