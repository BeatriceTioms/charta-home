import { createClient } from "./server";
import type {
  ApartmentPhotoRow,
  ApartmentState,
  BuildingPerformance,
  BuildingRow,
  ChargeStatusRow,
  EventRow,
  SubscriptionRow,
  TechnicianPerformance,
  TicketRow,
} from "./types";

/**
 * Read helpers for Server Components. Every call runs as the signed in user,
 * so row level security decides what comes back. No agency_id filter is needed
 * in the query itself, which is the point of putting the boundary in the
 * database rather than in application code.
 */

export async function getCurrentAgency() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("memberships")
    .select("agency_id, role, full_name, agencies(*)")
    .limit(1)
    .maybeSingle();

  return data ?? null;
}

export async function getBuildings(): Promise<BuildingRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("buildings")
    .select("*")
    .order("name");
  if (error) throw error;
  return data ?? [];
}

export async function getBuildingPerformance(): Promise<BuildingPerformance[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("v_building_performance").select("*");
  if (error) throw error;
  return data ?? [];
}

export async function getApartmentStates(buildingId: string): Promise<ApartmentState[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("v_apartment_state")
    .select("*")
    .eq("building_id", buildingId)
    .order("label");
  if (error) throw error;
  return data ?? [];
}

export async function getOpenCharges(buildingId: string): Promise<ChargeStatusRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("v_charge_status")
    .select("*")
    .neq("state", "paid")
    .order("due_on");
  if (error) throw error;
  // The view has no building_id, so narrow through the apartments of the building.
  const states = await getApartmentStates(buildingId);
  const leaseIds = new Set(states.map((s) => s.lease_id).filter(Boolean));
  return (data ?? []).filter((c) => leaseIds.has(c.lease_id));
}

export async function getTickets(buildingId: string): Promise<TicketRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tickets")
    .select("*")
    .eq("building_id", buildingId)
    .order("opened_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getEvents(buildingId: string): Promise<EventRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("events")
    .select("*")
    .eq("building_id", buildingId)
    .order("starts_at");
  if (error) throw error;
  return data ?? [];
}

export async function getSubscription(): Promise<SubscriptionRow | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("subscriptions").select("*").maybeSingle();
  return data ?? null;
}

/** Powers the technicians tab: jobs done, money paid, average delay. */
export async function getTechnicianPerformance(): Promise<TechnicianPerformance[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("v_technician_performance")
    .select("*")
    .order("full_name");
  if (error) throw error;
  return data ?? [];
}

export async function getApartmentPhotos(apartmentId: string): Promise<ApartmentPhotoRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("apartment_photos")
    .select("*")
    .eq("apartment_id", apartmentId)
    .order("position");
  if (error) throw error;
  return data ?? [];
}

/**
 * The photo bucket is private, so the browser needs a short lived signed URL
 * rather than a public one. An hour is long enough for a dashboard session.
 */
export async function signPhotoUrls(paths: string[]): Promise<Record<string, string>> {
  if (paths.length === 0) return {};
  const supabase = await createClient();
  const { data, error } = await supabase.storage
    .from("apartment-photos")
    .createSignedUrls(paths, 60 * 60);
  if (error) throw error;
  const pairs: [string, string][] = [];
  for (const entry of data ?? []) {
    if (entry.path && entry.signedUrl) pairs.push([entry.path, entry.signedUrl]);
  }
  return Object.fromEntries(pairs);
}
