import { redirect } from "next/navigation";
import { AdminDashboard } from "@/components/admin/AdminDashboard";
import { listAgencies } from "@/lib/supabase/admin-actions";
import { createClient } from "@/lib/supabase/server";

/**
 * The platform's own desk. The middleware has already turned away anybody
 * not in platform_admins; the listing function refuses them again, and a
 * refusal here sends them to their own dashboard rather than to an error.
 */
export default async function AdminPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const rows = await listAgencies();
  if (rows === null) redirect(`/${locale}/dashboard`);

  // Staff are not agencies, so most of them have no dashboard to go back to.
  // The link is offered only to somebody who also belongs to one.
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const { count } = await supabase
    .from("memberships")
    .select("agency_id", { count: "exact", head: true })
    .eq("user_id", auth.user?.id ?? "");

  return (
    <AdminDashboard
      rows={rows}
      me={{ email: auth.user?.email ?? "", hasAgency: (count ?? 0) > 0 }}
    />
  );
}
