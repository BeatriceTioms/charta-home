import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import { legalDoc } from "@/lib/legal";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return pageMetadata(locale, legalDoc(locale, "deleteAccount").meta, "/delete-account");
}

export default function DeleteAccountLayout({ children }: { children: React.ReactNode }) {
  return children;
}
