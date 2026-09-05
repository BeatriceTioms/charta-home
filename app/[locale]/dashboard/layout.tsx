import type { Metadata } from "next";
import Script from "next/script";
import { Shell } from "@/components/dashboard/Shell";
import { getDictionary } from "@/lib/i18n";
import { redirect } from "next/navigation";
import { loadPortfolio } from "@/lib/supabase/adapters";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

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

export default async function DashboardLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  // One read for the whole dashboard. Row level security scopes it to the
  // signed in agency, and a null result means run on the mock instead.
  const seed = await loadPortfolio();

  // No agency, but on the platform's staff: their place is the desk, not a
  // screen saying they have no agency.
  if (seed === null && isSupabaseConfigured()) {
    const { locale } = await params;
    const supabase = await createClient();
    const { data: staff } = await supabase.rpc("is_platform_admin");
    if (staff === true) redirect(`/${locale}/admin`);
  }

  return (
    <>
      <Script id="charta-theme" strategy="beforeInteractive">
        {`(function(){try{var t=localStorage.getItem("charta-theme")||"dark";document.documentElement.classList.toggle("dark",t==="dark");}catch(e){}})();`}
      </Script>
      <Shell seed={seed}>{children}</Shell>
    </>
  );
}
