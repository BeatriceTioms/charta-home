import { json, listingSelect, mobileDb, toListing } from "@/lib/mobile";

export const dynamic = "force-dynamic";

/** Homes agencies chose to publish (apartments.listed). Public: no sign-in. */
export async function GET() {
  const admin = mobileDb();
  const { data, error } = await admin.from("apartments").select(listingSelect).eq("listed", true).limit(200);
  if (error) return json({ error: error.message }, 500);
  return json(await Promise.all((data ?? []).map(toListing)));
}
