import { json, listingSelect, mobileDb, toListing } from "@/lib/mobile";

export const dynamic = "force-dynamic";

/**
 * Every home, for the app. Public: no sign-in.
 *
 * No flag decides this any more. A unit an agency never remembered to
 * publish was invisible while it stood empty, so every unit is here and the
 * dates say what can be done with it: a free one can be taken now, one with
 * a tenant in it shows the day it comes free.
 */
export async function GET() {
  const admin = mobileDb();
  const { data, error } = await admin.from("apartments").select(listingSelect).limit(200);
  if (error) return json({ error: error.message }, 500);
  return json(await Promise.all((data ?? []).map(toListing)));
}
