import type { Metadata } from "next";
import "./globals.css";

const siteUrl = "https://chartahome.com";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Charta Home | Property management software for real estate agencies",
    template: "%s | Charta Home",
  },
  description:
    "Charta Home is the property management platform for real estate agencies. Track ROI on every building, collect rent on time with smart WhatsApp reminders, and manage maintenance from first report to confirmed fix. Launching first in Conakry, Guinea. Your first month is free.",
  applicationName: "Charta Home",
  keywords: [
    "property management software",
    "real estate agency software",
    "rent collection software",
    "WhatsApp rent reminders",
    "building ROI tracking",
    "landlord software",
    "tenant management",
    "maintenance tracking software",
    "property management Guinea",
    "property management Conakry",
    "logiciel gestion immobilière",
    "gestion locative Conakry",
    "gestion immobilière Guinée",
    "Charta Home",
  ],
  authors: [{ name: "Charta Home", url: siteUrl }],
  creator: "Charta Home",
  publisher: "Charta Home",
  category: "Real estate software",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: siteUrl,
    siteName: "Charta Home",
    locale: "en_US",
    title: "Charta Home | Property management software for real estate agencies",
    description:
      "Track ROI on every building, collect rent on time with smart WhatsApp reminders, and manage maintenance in one calm place. Built for real estate agencies. First month free.",
    images: [
      {
        url: "/hero-door.png",
        width: 1536,
        height: 1024,
        alt: "Charta Home, open the door to smarter property management",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Charta Home | Property management for real estate agencies",
    description:
      "ROI on every building, rent collected on time, maintenance over WhatsApp. First month free.",
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

const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${siteUrl}/#organization`,
      name: "Charta Home",
      url: siteUrl,
      email: "hello@chartahome.com",
      description:
        "Property management software for real estate agencies. ROI on every building, smart rent collection, and maintenance handled over WhatsApp.",
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
        availableLanguage: ["English", "French"],
      },
    },
    {
      "@type": "WebSite",
      "@id": `${siteUrl}/#website`,
      url: siteUrl,
      name: "Charta Home",
      publisher: { "@id": `${siteUrl}/#organization` },
    },
    {
      "@type": "SoftwareApplication",
      "@id": `${siteUrl}/#software`,
      name: "Charta Home",
      url: siteUrl,
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      description:
        "Charta Home helps real estate agencies track the ROI of every building and apartment, collect rent on time with smart reminders over WhatsApp, SMS, and email, and track maintenance from tenant report to confirmed fix.",
      offers: [
        {
          "@type": "Offer",
          name: "Starter",
          price: "29",
          priceCurrency: "USD",
          description: "1 building, up to 20 apartments, ROI dashboard, email reminders.",
        },
        {
          "@type": "Offer",
          name: "Growth",
          price: "79",
          priceCurrency: "USD",
          description:
            "Up to 5 buildings and 150 apartments, WhatsApp reminders, maintenance tracking, owner reports.",
        },
        {
          "@type": "Offer",
          name: "Agency",
          price: "199",
          priceCurrency: "USD",
          description:
            "Unlimited buildings and apartments, advanced reporting, priority WhatsApp flows, dedicated support.",
        },
      ],
      featureList:
        "Building and apartment ROI tracking, smart rent reminders over WhatsApp SMS and email, printable rent receipts, maintenance ticketing over WhatsApp, owner reports, occupancy and vacancy analytics",
    },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Lora:ital,wght@0,400;0,500;0,600;1,400&family=Caveat:wght@600;700&display=swap"
          rel="stylesheet"
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
