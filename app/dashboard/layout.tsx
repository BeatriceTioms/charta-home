import type { Metadata } from "next";
import Script from "next/script";
import { Shell } from "@/components/dashboard/Shell";

export const metadata: Metadata = {
  title: "Dashboard",
  robots: { index: false, follow: false },
};

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
