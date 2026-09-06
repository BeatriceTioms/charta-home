import { notFound, redirect } from "next/navigation";
import { AgencyDetail } from "@/components/admin/AgencyDetail";
import { adminIdentity, agencyDetail, listAgencies } from "@/lib/supabase/admin-actions";

/**
 * One agency's file. A person who is not staff is turned away by the
 * middleware and again by the function; an id that is not an agency is a
 * missing page rather than a blank one.
 */
export default async function AdminAgencyPage({
  params,
}: {
  params: Promise<{ locale: string; agencyId: string }>;
}) {
  const { locale, agencyId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(agencyId)) notFound();
  const doc = await agencyDetail(agencyId);
  if (doc === null) {
    // Refused, or unknown. Refused sends them home; unknown is a 404.
    const staff = await listAgencies();
    if (staff === null) redirect(`/${locale}/dashboard`);
    notFound();
  }
  return <AgencyDetail doc={doc} me={await adminIdentity()} />;
}
