import type { ActivityItem, Building, Payment, RentStatus, Technician, Ticket } from "@/lib/data";
import { isSupabaseConfigured } from "./config";
import { createClient } from "./server";

/**
 * Turns live rows into the shapes the dashboard already renders.
 *
 * The interface was built against `lib/data.ts`, and every page reads it
 * through one provider. Mapping onto those same types here means the pages do
 * not change at all, and the mock stays available as the control: when no
 * project is configured this returns null and the provider seeds from the mock.
 */

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** "2026-08-01" becomes "Aug 2026", the period format the tables display. */
const periodOf = (iso: string) =>
  `${MONTHS[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}`;

/** "2026-08-02" becomes "2 Aug". */
const dayOf = (iso: string) =>
  `${Number(iso.slice(8, 10))} ${MONTHS[Number(iso.slice(5, 7)) - 1]}`;

/** E.164 is stored, but a Guinean number reads as +224 620 14 22 31. */
const readablePhone = (e164: string | null) => {
  if (!e164) return "";
  const digits = e164.replace(/\D/g, "");
  if (!digits.startsWith("224") || digits.length !== 12) return e164;
  const local = digits.slice(3);
  return `+224 ${local.slice(0, 3)} ${local.slice(3, 5)} ${local.slice(5, 7)} ${local.slice(7)}`;
};

const daysBetween = (from: string, to: string) =>
  Math.max(0, Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000));

/** Postgres spells it in_progress, the interface in-progress. */
const ticketStatus = (raw: string): Ticket["status"] =>
  raw === "in_progress" ? "in-progress" : (raw as Ticket["status"]);

export type Portfolio = {
  /** The signed in user's agency, which every insert must carry. */
  agencyId: string;
  agencyInfo: { name: string; city: string; country: string; whatsapp: string };
  buildings: Building[];
  tickets: Ticket[];
  technicians: Technician[];
  activity: ActivityItem[];
};

/**
 * Reads the signed in agency's whole portfolio. Row level security decides
 * what comes back, so none of these queries filters by agency.
 */
export async function loadPortfolio(): Promise<Portfolio | null> {
  if (!isSupabaseConfigured()) return null;

  const supabase = await createClient();

  // The authoritative source for the agency id. Buildings and apartment
  // states are both empty for a brand new agency, so deriving it from their
  // first row silently produced "" and made every write look unconfigured.
  const { data: agencyRow } = await supabase
    .from("agencies")
    .select("id, name, city, country, whatsapp_number")
    .limit(1)
    .maybeSingle();
  if (!agencyRow) return null;
  const agencyId = agencyRow.id;

  const [
    { data: buildingRows },
    { data: performance },
    { data: states },
    { data: charges },
    { data: allocations },
    { data: ticketRows },
    { data: technicianRows },
    { data: photoRows },
    { data: eventRows },
  ] = await Promise.all([
    supabase.from("buildings").select("*").order("name"),
    supabase.from("v_building_performance").select("*"),
    supabase.from("v_apartment_state").select("*"),
    supabase.from("v_charge_status").select("*").order("period_start"),
    supabase.from("payment_allocations").select("rent_charge_id, payments(paid_on)"),
    supabase
      .from("tickets")
      .select(
        "id, title, description, status, priority, reported_via, cost, opened_at, resolved_at, building_id, technician_id, apartments(label), residents(full_name), technicians(full_name)"
      )
      .order("opened_at", { ascending: false }),
    supabase.from("technicians").select("*").order("full_name"),
    supabase.from("apartment_photos").select("*").order("position"),
    supabase.from("events").select("*").order("starts_at"),
  ]);

  // Nothing to show means the account has no buildings yet, not a failure.
  if (!buildingRows) return null;

  // The photo bucket is private, so the browser needs signed URLs. One batch
  // for the whole gallery; an hour outlives any dashboard visit.
  const photosByApartment = new Map<string, { id: string; src: string; caption?: string; path: string }[]>();
  if ((photoRows ?? []).length > 0) {
    const paths = (photoRows ?? []).map((p) => p.storage_path);
    const { data: signed } = await supabase.storage
      .from("apartment-photos")
      .createSignedUrls(paths, 60 * 60);
    const urlByPath = new Map(
      (signed ?? []).filter((x) => x.path && x.signedUrl).map((x) => [x.path as string, x.signedUrl])
    );
    for (const row of photoRows ?? []) {
      const src = urlByPath.get(row.storage_path);
      if (!src) continue;
      const list = photosByApartment.get(row.apartment_id) ?? [];
      list.push({ id: row.id, src, caption: row.caption ?? undefined, path: row.storage_path });
      photosByApartment.set(row.apartment_id, list);
    }
  }

  // When a charge was settled, and on what day.
  const paidOnByCharge = new Map<string, string>();
  for (const row of allocations ?? []) {
    const paidOn = (row as { payments: { paid_on: string } | null }).payments?.paid_on;
    if (row.rent_charge_id && paidOn) paidOnByCharge.set(row.rent_charge_id, paidOn);
  }

  const paymentsByLease = new Map<string, Payment[]>();
  for (const charge of charges ?? []) {
    if (!charge.lease_id) continue;
    const list = paymentsByLease.get(charge.lease_id) ?? [];
    list.push({
      month: periodOf(charge.period_start),
      amount: Number(charge.amount),
      paidOn: paidOnByCharge.get(charge.rent_charge_id)
        ? dayOf(paidOnByCharge.get(charge.rent_charge_id)!)
        : null,
      status: charge.state as RentStatus,
    });
    paymentsByLease.set(charge.lease_id, list);
  }

  const perfByBuilding = new Map((performance ?? []).map((p) => [p.building_id, p]));

  const buildings: Building[] = buildingRows.map((b) => {
    const perf = perfByBuilding.get(b.id);
    const units = (states ?? []).filter((s) => s.building_id === b.id);

    return {
      id: b.id,
      name: b.name,
      address: b.address,
      city: b.city,
      // Empty until the agency uploads one; the interface draws a monogram
      // tile rather than borrowing somebody else's photograph.
      photo: b.photo_path ?? "",
      interior: b.interior_path ?? "",
      amenities: b.amenities ?? [],
      incomeYtd: Number(perf?.income_ytd ?? 0),
      expensesYtd: Number(perf?.expenses_ytd ?? 0),
      netYield: Number(perf?.net_yield_pct ?? 0),
      apartments: units.map((u) => ({
        id: u.apartment_id,
        leaseId: u.lease_id ?? undefined,
        label: u.label,
        rooms: u.rooms ?? 0,
        bathrooms: u.bathrooms ?? 0,
        sqm: u.sqm ?? 0,
        rent: Number(u.rent_amount ?? u.base_rent ?? 0),
        cycle: (u.cycle ?? "monthly") as "monthly" | "yearly",
        tenant: u.is_occupied && u.resident_name
          ? {
              name: u.resident_name,
              phone: readablePhone(u.resident_phone),
              since: u.lease_started_on ? periodOf(u.lease_started_on) : "",
              // Absent on an open ended lease, which is the common case.
              until: u.lease_ends_on ? periodOf(u.lease_ends_on) : undefined,
            }
          : undefined,
        // A vacant unit has no rent state; the interface treats that as pending.
        rentStatus: (u.rent_state ?? "pending") as RentStatus,
        // Yield is measured per building, so a unit reports its building's.
        netYield: Number(perf?.net_yield_pct ?? 0),
        payments: u.lease_id ? paymentsByLease.get(u.lease_id) ?? [] : [],
        // Only what the agency actually uploaded.
        photos: photosByApartment.get(u.apartment_id) ?? [],
      })),
    } as Building;
  });

  const now = new Date().toISOString();

  const tickets: Ticket[] = (ticketRows ?? []).map((x) => {
    const opened = x.opened_at as string;
    const closed = (x.resolved_at as string | null) ?? now;
    return {
      // A uuid is unreadable in a table, so show a short stable reference.
      id: `T-${x.id.slice(0, 6).toUpperCase()}`,
      dbId: x.id,
      title: x.title,
      description: x.description ?? undefined,
      priority: (x.priority ?? "normal") as Ticket["priority"],
      technicianId: x.technician_id ?? undefined,
      buildingId: x.building_id,
      apartment:
        (x as { apartments: { label: string } | null }).apartments?.label ?? "Common area",
      status: ticketStatus(x.status),
      reportedVia: x.reported_via as Ticket["reportedVia"],
      assignee:
        (x as { technicians: { full_name: string } | null }).technicians?.full_name ?? undefined,
      tenant:
        (x as { residents: { full_name: string } | null }).residents?.full_name ?? undefined,
      cost: x.cost === null ? undefined : Number(x.cost),
      openedOn: dayOf(opened),
      daysOpen: daysBetween(opened, closed),
      month: MONTHS[Number(opened.slice(5, 7)) - 1],
      year: Number(opened.slice(0, 4)),
    };
  });

  const technicians: Technician[] = (technicianRows ?? []).map((tech) => ({
    id: tech.id,
    name: tech.full_name,
    trade: tech.trade ?? "",
    phone: readablePhone(tech.phone_e164),
    isExternal: tech.is_external,
    since: periodOf(String(tech.created_at).slice(0, 10)),
  }));

  // "09:00" from an ISO timestamp, local to the server's clock. Reminders and
  // showings in Conakry are all on the same tz, so this stays simple.
  const timeOf = (iso: string) => new Date(iso).toISOString().slice(11, 16);

  const activity: ActivityItem[] = (eventRows ?? []).map((e) => ({
    buildingId: e.building_id,
    time: timeOf(e.starts_at),
    title: e.title,
    detail: e.detail ?? "",
    kind: e.kind,
    who: e.assignee ?? "",
  }));

  const agencyInfo = {
    name: agencyRow.name,
    city: agencyRow.city,
    country: agencyRow.country,
    whatsapp: agencyRow.whatsapp_number ?? "",
  };

  return { agencyId, agencyInfo, buildings, tickets, technicians, activity };
}
