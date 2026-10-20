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
export async function toListing(row: any, availability?: { free_from: string | null; occupied: boolean }) {
  const b = row.buildings ?? {};
  const photos = [
    ...(await signedUrls("apartment-photos", [row.photo_path])),
    ...(await signedUrls("building-photos", [b.photo_path, b.interior_path])),
  ];
  const rates: Record<string, number> = {};
  // Bands are what the agency sets: so many nights to so many, at this much
  // per night. `rates` keeps the old shape the app already reads, one entry
  // per band at the length it starts, so nothing breaks while the app moves
  // to `rate_bands`, which is the whole truth.
  // A deployment reaches Vercel before its migration is pasted into
  // Supabase, and in that window these rows are still the old packages: so
  // many nights for a total. Read either, so the order of the two cannot
  // take the listings down.
  const bands = [...(row.stay_rates ?? [])]
    .map((r: Record<string, number | null>) => {
      const min = Number(r.min_nights ?? r.nights ?? 1);
      const perNight =
        r.price_per_night != null
          ? Number(r.price_per_night)
          : Math.round(Number(r.price ?? 0) / Math.max(1, Number(r.nights ?? 1)));
      return {
        min_nights: min,
        max_nights: r.min_nights != null ? (r.max_nights === null ? null : Number(r.max_nights)) : min,
        price_per_night: perNight,
      };
    })
    .filter((b) => b.price_per_night > 0)
    .sort((a, b) => a.min_nights - b.min_nights);
  for (const b of bands) rates[String(b.min_nights)] = b.min_nights * b.price_per_night;
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
    // Every unit is listed, so a let one says when it comes free. With
    // `availability` (apartments_availability) that also counts upcoming
    // leases and months already reserved in the app, and is null when the
    // tenancy has no end date. Without it: the end of the tenancy, or the
    // date the agency set, or today.
    available_from: availability
      ? availability.free_from
      : lease?.ends_on ?? row.available_from ?? new Date().toISOString().slice(0, 10),
    occupied: availability ? availability.occupied : Boolean(lease),
    lat: b.latitude != null ? Number(b.latitude) : null,
    lng: b.longitude != null ? Number(b.longitude) : null,
    stay_rates: row.short_stay ? rates : {},
    rate_bands: row.short_stay ? bands : [],
    verified: true,
  };
}

export const listingSelect = `
  id, label, floor, rooms, bathrooms, sqm, base_rent, photo_path, short_stay, kind,
  listing_title, listing_description, available_from,
  buildings ( name, city, neighborhood, latitude, longitude, photo_path, interior_path, amenities, notes ),
  agencies ( name, whatsapp_number, currency ),
  stay_rates ( * ),
  leases ( status, ends_on )
`;
