import { redirect } from "next/navigation";
import { AdminSubscriptions } from "@/components/admin/AdminSubscriptions";
import { adminIdentity, listSubscriptions } from "@/lib/supabase/admin-actions";

export default async function AdminSubscriptionsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const rows = await listSubscriptions();
  if (rows === null) redirect(`/${locale}/dashboard`);
  return <AdminSubscriptions rows={rows} me={await adminIdentity()} />;
}
