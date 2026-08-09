import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Talk to a real person at Charta Home in Conakry, Guinea. Questions about the free month, a large portfolio, or your agency: write to us and we reply within the day.",
  alternates: { canonical: "/contact" },
  openGraph: {
    title: "Contact Charta Home",
    description:
      "Email, WhatsApp, or book a walkthrough. A person, not a bot, replies within the day.",
    url: "/contact",
    images: ["/hero-door.png"],
  },
};

export default function ContactLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
