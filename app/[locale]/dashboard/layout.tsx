import type { Metadata } from "next";
import Script from "next/script";
import { Shell } from "@/components/dashboard/Shell";
import { getDictionary } from "@/lib/i18n";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return {
    title: getDictionary(locale).meta.dashboard.title,
    robots: { index: false, follow: false },
  };
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Script id="charta-theme" strategy="beforeInteractive">
        {`(function(){try{var t=localStorage.getItem("charta-theme")||"dark";document.documentElement.classList.toggle("dark",t==="dark");}catch(e){}})();`}
      </Script>
      <Shell>{children}</Shell>
    </>
  );
}
