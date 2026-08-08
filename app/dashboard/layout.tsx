import type { Metadata } from "next";
import { Shell } from "@/components/dashboard/Shell";

export const metadata: Metadata = {
  title: "Dashboard | Charta Home",
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <Shell>{children}</Shell>;
}
