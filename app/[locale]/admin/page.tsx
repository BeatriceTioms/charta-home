import { redirect } from "next/navigation";
import { AdminDashboard } from "@/components/admin/AdminDashboard";
import { listAgencies } from "@/lib/supabase/admin-actions";

/**
 * The platform's own desk. The middleware has already turned away anybody
 * not in platform_admins; the listing function refuses them again, and a
 * refusal here sends them to their own dashboard rather than to an error.
 */
export default async function AdminPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const rows = await listAgencies();
  if (rows === null) redirect(`/${locale}/dashboard`);
  return <AdminDashboard rows={rows} />;
}
