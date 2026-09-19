import { getSettingsData } from "@/lib/supabase/queries";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { onlinePaymentAvailable } from "@/lib/supabase/actions";
import { SettingsForm } from "@/components/dashboard/SettingsForm";

/**
 * Server wrapper: loads the agency and its team roster (email included,
 * which only `list_agency_members` can supply), then hands everything to the
 * client form. Without a configured project this renders the same form on
 * local state, exactly as it did before the backend existed.
 *
 * `?payment=` is where PayUnit sends the owner back. The id is passed down
 * and the form asks the server what became of it.
 */
export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ payment?: string }>;
}) {
  const data = isSupabaseConfigured() ? await getSettingsData() : null;
  const { payment } = await searchParams;
  const canPayOnline = data ? await onlinePaymentAvailable(data.agency.id) : false;
  return <SettingsForm data={data} canPayOnline={canPayOnline} returnedPayment={payment ?? null} />;
}
