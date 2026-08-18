import { getSettingsData } from "@/lib/supabase/queries";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { SettingsForm } from "@/components/dashboard/SettingsForm";

/**
 * Server wrapper: loads the agency, its reminder cadence and its team roster
 * (email included, which only `list_agency_members` can supply), then hands
 * everything to the client form. Without a configured project this renders
 * the same form on local state, exactly as it did before the backend existed.
 */
export default async function SettingsPage() {
  const data = isSupabaseConfigured() ? await getSettingsData() : null;
  return <SettingsForm data={data} />;
}
