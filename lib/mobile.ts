/**
 * Shared by the /api/mobile routes the resident app calls.
 *
 * The app signs in with Supabase directly and sends its access token as a
 * Bearer header. These routes check that token with Supabase, then read with
 * the service role, always filtered to that user: the token decides whose
 * data, never anything in the request body.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/server";

/**
 * The service-role client, untyped: lib/supabase/types.ts is hand written and
 * does not list the resident-app tables yet. Once types are regenerated after
 * the migration (npx supabase gen types …), use createAdminClient() directly.
 */
export function mobileDb(): SupabaseClient {
  return createAdminClient() as unknown as SupabaseClient;
}

export type MobileUser = { id: string; email: string | null; name: string; phone: string | null };

export async function mobileUser(request: Request): Promise<MobileUser | null> {
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) return null;
  const { data, error } = await mobileDb().auth.getUser(token);
  if (error || !data.user) return null;
  const meta = (data.user.user_metadata ?? {}) as Record<string, unknown>;
  return {
    id: data.user.id,
    email: data.user.email ?? null,
    name: String(meta.full_name ?? data.user.email?.split("@")[0] ?? ""),
    phone: (meta.phone as string | undefined) ?? null,
  };
}

/** Private bucket paths → short-lived URLs the app can load. */
export async function signedUrls(bucket: string, paths: (string | null | undefined)[]): Promise<string[]> {
  const clean = paths.filter((p): p is string => Boolean(p));
  if (clean.length === 0) return [];
  const { data } = await mobileDb().storage.from(bucket).createSignedUrls(clean, 60 * 60);
  return (data ?? []).map((d) => d.signedUrl).filter(Boolean) as string[];
}

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

export const unauthorized = () => json({ error_key: "err_generic", error: "sign in first" }, 401);

/**
 * A listed apartment in the shape the app reads (lib/backend/supabase_backend.dart,
 * _property). Rows come from the `listingRows` query below.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function toListing(row: any) {
  const b = row.buildings ?? {};
  const photos = [
    ...(await signedUrls("apartment-photos", [row.photo_path])),
    ...(await signedUrls("building-photos", [b.photo_path, b.interior_path])),
  ];
  const rates: Record<string, number> = {};
  for (const r of row.stay_rates ?? []) rates[String(r.nights)] = Number(r.price);
  const lease = (row.leases ?? []).find((l: { status: string }) => l.status === "active");
  return {
    id: row.id,
    title: row.listing_title || `${b.name ?? ""} · ${row.label}`,
    building: b.name ?? "",
    neighborhood: b.neighborhood ?? "",
    city: b.city ?? "",
    kind: row.kind ?? "apartment",
    photos,
    rent: Number(row.base_rent ?? 0),
    cycle: "monthly",
    deposit: Number(row.base_rent ?? 0) * 2,
    rooms: row.rooms ?? 0,
    bathrooms: row.bathrooms ?? 0,
    sqm: Number(row.sqm ?? 0),
    floor: row.floor ?? "",
    amenities: b.amenities ?? [],
    description: row.listing_description ?? b.notes ?? "",
    agency: row.agencies?.name ?? "",
    agent: { name: row.agencies?.name ?? "", phone: row.agencies?.whatsapp_number ?? "" },
    // Every unit is listed, so a let one says when it comes free: the end
    // of the tenancy, or the date the agency set, or today.
    available_from: lease?.ends_on ?? row.available_from ?? new Date().toISOString().slice(0, 10),
    lat: b.latitude != null ? Number(b.latitude) : null,
    lng: b.longitude != null ? Number(b.longitude) : null,
    stay_rates: row.short_stay ? rates : {},
    verified: true,
  };
}

export const listingSelect = `
  id, label, floor, rooms, bathrooms, sqm, base_rent, photo_path, short_stay, kind,
  listing_title, listing_description, available_from,
  buildings ( name, city, neighborhood, latitude, longitude, photo_path, interior_path, amenities, notes ),
  agencies ( name, whatsapp_number, currency ),
  stay_rates ( nights, price ),
  leases ( status, ends_on )
`;
