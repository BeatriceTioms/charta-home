import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import { legalDoc } from "@/lib/legal";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return pageMetadata(locale, legalDoc(locale, "privacy").meta, "/privacy");
}

export default function PrivacyLayout({ children }: { children: React.ReactNode }) {
  return children;
}
