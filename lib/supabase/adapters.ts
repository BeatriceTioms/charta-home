import { periodValue, type ActivityItem, type Building, type LeaseCycle, type Payment, type PaymentRecord, type RentStatus, type Technician, type Ticket } from "@/lib/data";
import { requestedAgencyId } from "@/lib/agency";
import { isSupabaseConfigured } from "./config";
import { createClient } from "./server";
import type { MemberRole } from "./types";

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
  /** The agency being shown, which every insert must carry. */
  agencyId: string;
  /** Every agency this person belongs to, for the switcher. */
  agencies: { id: string; name: string; city: string }[];
  agencyInfo: {
    name: string;
    city: string;
    country: string;
    whatsapp: string;
    currency: string;
    /** Printed on receipts. Blank until the agency fills them in. */
    address: string;
    email: string;
    registration: string;
  };
  /** The signed in person, not the agency. Drives the greeting and the roles. */
  currentUser: { name: string; email: string; role: MemberRole; allowedPages: string[] };
  buildings: Building[];
  tickets: Ticket[];
  technicians: Technician[];
  activity: ActivityItem[];
};

/**
 * Reads one agency's whole portfolio.
 *
 * Row level security decides what a reader *may* see, which is every agency
 * they belong to. Which of those they are looking at is a separate question,
 * answered by the cookie, and every query below is filtered by the answer.
 */
export async function loadPortfolio(): Promise<Portfolio | null> {
  if (!isSupabaseConfigured()) return null;

  const supabase = await createClient();

  // Every agency this person belongs to. Row level security answers with
  // exactly those, so no filter is needed to ask the question and none of the
  // answer can be somebody else's.
  const { data: agencyRows } = await supabase
    .from("agencies")
    .select("id, name, city, country, whatsapp_number, currency")
    .order("name");
  if (!agencyRows || agencyRows.length === 0) return null;

  // What the cookie asks for, honoured only if it is one of theirs. A stale
  // cookie from an agency they have since left falls back to the first rather
  // than showing an empty dashboard nobody can explain.
  const asked = await requestedAgencyId();
  const agencyRow = agencyRows.find((a) => a.id === asked) ?? agencyRows[0];
  const agencyId = agencyRow.id;

  const agencies = agencyRows.map((a) => ({ id: a.id, name: a.name, city: a.city }));

  // Asked for separately, and allowed to fail. These arrive with a migration,
  // and a deployment reaches Vercel before that migration is pasted in; a
  // single select naming a column that does not exist yet would fail the whole
  // row, and a null agency is the screen that says there is no agency at all.
  const { data: details } = await supabase
    .from("agencies")
    .select("address, email, registration")
    .eq("id", agencyId)
    .maybeSingle();

  // Who is reading this. An agency has as many people in it as it hires, and
  // each one signs in as themselves, so the name on screen and the permissions
  // behind it both come from this row rather than from the agency.
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id ?? "";

  // Name and role are asked for on their own, and page access separately.
  // A deployment reaches Vercel before its migration is pasted into Supabase,
  // and in that window selecting a column that does not exist yet fails the
  // whole row: the name fell back to the email and an owner was shown as a
  // manager. Two queries cost one round trip and cannot do that.
  const { data: membership } = await supabase
    .from("memberships")
    .select("full_name, role")
    .eq("agency_id", agencyId)
    .eq("user_id", userId)
    .maybeSingle();

  const { data: access } = await supabase
    .from("memberships")
    .select("allowed_pages")
    .eq("agency_id", agencyId)
    .eq("user_id", userId)
    .maybeSingle();

  const currentUser = {
    // Falling back to the local part of the address is better than a blank
    // greeting for someone who has not filled their name in yet.
    name: membership?.full_name?.trim() || auth.user?.email?.split("@")[0] || "",
    email: auth.user?.email ?? "",
    role: (membership?.role ?? "manager") as MemberRole,
    // Navigation only. The route guard in middleware reads the same column,
    // and RLS guards the data whatever either of them says. Before the
    // migration lands there is no column, and everything is shown.
    allowedPages: (access?.allowed_pages as string[] | null) ?? [
      "dashboard", "apartments", "rent", "maintenance",
    ],
  };

  const [
    { data: buildingRows },
    { data: performance },
    { data: unitPerformance },
    { data: states },
    { data: charges },
    { data: allocations },
    { data: ticketRows },
    { data: technicianRows },
    { data: photoRows },
    { data: eventRows },
    // Every one of these is filtered by agency now. Row level security answers
    // with every agency the reader belongs to, which was the whole answer while
    // that was always one; with two it would hand back both portfolios shuffled
    // together, and the dashboard would add up buildings from a business the
    // reader is not currently looking at.
  ] = await Promise.all([
    supabase.from("buildings").select("*").eq("agency_id", agencyId).order("name"),
    supabase.from("v_building_performance").select("*").eq("agency_id", agencyId),
    supabase.from("v_apartment_performance").select("*").eq("agency_id", agencyId),
    supabase.from("v_apartment_state").select("*").eq("agency_id", agencyId),
    supabase
      .from("v_charge_status")
      .select("*")
      .eq("agency_id", agencyId)
      .order("period_start"),
    supabase
      .from("payment_allocations")
      .select(
        "rent_charge_id, amount, payments(id, amount, paid_on, method, reference, proof_path, lease_id)"
      )
      .eq("agency_id", agencyId),
    supabase
      .from("tickets")
      .select(
        "id, title, description, status, priority, reported_via, cost, opened_at, resolved_at, building_id, technician_id, apartments(label), residents(full_name), technicians(full_name)"
      )
      .eq("agency_id", agencyId)
      .order("opened_at", { ascending: false }),
    supabase.from("technicians").select("*").eq("agency_id", agencyId).order("full_name"),
    supabase
      .from("apartment_photos")
      .select("*")
      .eq("agency_id", agencyId)
      .order("position"),
    supabase.from("events").select("*").eq("agency_id", agencyId).order("starts_at"),
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

  // The building bucket is private too, so its photo needs the same treatment.
  const buildingPhotoUrls = new Map<string, string>();
  const buildingPaths = (buildingRows ?? [])
    .map((b) => b.photo_path)
    .filter((x): x is string => Boolean(x));
  if (buildingPaths.length > 0) {
    const { data: signed } = await supabase.storage
      .from("building-photos")
      .createSignedUrls(buildingPaths, 60 * 60);
    for (const entry of signed ?? []) {
      if (entry.path && entry.signedUrl) buildingPhotoUrls.set(entry.path, entry.signedUrl);
    }
  }

  type AllocationRow = {
    rent_charge_id: string;
    payments: {
      id: string;
      amount: number;
      paid_on: string;
      method: string;
      reference: string | null;
      proof_path: string | null;
      lease_id: string;
    } | null;
  };

  // Which payment settled which charge, and the payment itself. One payment
  // can settle several charges, which is exactly what a receipt has to say.
  const settledBy = new Map<string, AllocationRow["payments"]>();
  const paymentRows = new Map<string, NonNullable<AllocationRow["payments"]>>();
  for (const row of (allocations ?? []) as unknown as AllocationRow[]) {
    if (!row.rent_charge_id || !row.payments) continue;
    settledBy.set(row.rent_charge_id, row.payments);
    paymentRows.set(row.payments.id, row.payments);
  }

  // The slips live in the same private bucket as everything else, so the
  // browser needs signed URLs. One batch for all of them.
  const proofUrls = new Map<string, string>();
  const proofPaths = [...paymentRows.values()]
    .map((p) => p.proof_path)
    .filter((x): x is string => Boolean(x));
  if (proofPaths.length > 0) {
    const { data: signed } = await supabase.storage
      .from("receipts")
      .createSignedUrls(proofPaths, 60 * 60);
    for (const entry of signed ?? []) {
      if (entry.path && entry.signedUrl) proofUrls.set(entry.path, entry.signedUrl);
    }
  }

  const paymentsByLease = new Map<string, Payment[]>();
  // Every period a given payment settled, so the receipt can list them.
  const periodsByPayment = new Map<string, string[]>();

  for (const charge of charges ?? []) {
    if (!charge.lease_id) continue;
    const settlement = settledBy.get(charge.rent_charge_id);
    const period = periodOf(charge.period_start);

    const list = paymentsByLease.get(charge.lease_id) ?? [];
    list.push({
      month: period,
      amount: Number(charge.amount),
      paidOn: settlement ? dayOf(settlement.paid_on) : null,
      status: charge.state as RentStatus,
      paymentId: settlement?.id,
      proof: settlement?.proof_path ? proofUrls.get(settlement.proof_path) : undefined,
    });
    paymentsByLease.set(charge.lease_id, list);

    if (settlement) {
      const periods = periodsByPayment.get(settlement.id) ?? [];
      periods.push(period);
      periodsByPayment.set(settlement.id, periods);
    }
  }

  // One entry per transaction rather than per period, newest first, which is
  // the order somebody looking for "the receipt I just gave them" wants.
  const receiptsByLease = new Map<string, PaymentRecord[]>();
  for (const payment of paymentRows.values()) {
    const list = receiptsByLease.get(payment.lease_id) ?? [];
    list.push({
      id: payment.id,
      amount: Number(payment.amount),
      paidOn: payment.paid_on,
      method: payment.method,
      reference: payment.reference ?? "",
      proof: payment.proof_path ? proofUrls.get(payment.proof_path) : undefined,
      periods: (periodsByPayment.get(payment.id) ?? []).sort(
        (a, b) => periodValue(a) - periodValue(b)
      ),
    });
    receiptsByLease.set(payment.lease_id, list);
  }
  for (const list of receiptsByLease.values()) {
    list.sort((a, b) => b.paidOn.localeCompare(a.paidOn));
  }

  const perfByBuilding = new Map((performance ?? []).map((p) => [p.building_id, p]));
  // Per unit money in and out. The view arrives with a migration, so a null
  // here is a deployment ahead of its migration rather than a failure.
  const perfByApartment = new Map(
    (unitPerformance ?? []).map((p) => [p.apartment_id, p])
  );

  const buildings: Building[] = buildingRows.map((b) => {
    const perf = perfByBuilding.get(b.id);
    const units = (states ?? []).filter((s) => s.building_id === b.id);

    return {
      id: b.id,
      name: b.name,
      address: b.address,
      city: b.city,
      // Empty until the agency uploads one; the interface draws a placeholder
      // rather than borrowing somebody else's photograph.
      photo: b.photo_path ? buildingPhotoUrls.get(b.photo_path) ?? "" : "",
      photoPath: b.photo_path ?? undefined,
      interior: b.interior_path ?? "",
      amenities: b.amenities ?? [],
      incomeYtd: Number(perf?.income_ytd ?? 0),
      expensesYtd: Number(perf?.expenses_ytd ?? 0),
      netYield: Number(perf?.net_yield_pct ?? 0),
      apartments: units.map((u) => ({
        id: u.apartment_id,
        leaseId: u.lease_id ?? undefined,
        residentId: u.resident_id ?? undefined,
        label: u.label,
        rooms: u.rooms ?? 0,
        bathrooms: u.bathrooms ?? 0,
        sqm: u.sqm ?? 0,
        rent: Number(u.rent_amount ?? u.base_rent ?? 0),
        cycle: (u.cycle ?? "monthly") as LeaseCycle,
        // The raw start date, alongside the readable one. Closing a lease has
        // to refuse a date before it began, and that check needs the date
        // itself rather than the period it is displayed as.
        leaseStartsOn: u.lease_started_on ?? undefined,
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
        performance: {
          collected: Number(perfByApartment.get(u.apartment_id)?.collected_ytd ?? 0),
          expenses: Number(perfByApartment.get(u.apartment_id)?.expenses_ytd ?? 0),
          net: Number(perfByApartment.get(u.apartment_id)?.net_ytd ?? 0),
          marginPct:
            perfByApartment.get(u.apartment_id)?.net_margin_pct == null
              ? null
              : Number(perfByApartment.get(u.apartment_id)!.net_margin_pct),
        },
        payments: u.lease_id ? paymentsByLease.get(u.lease_id) ?? [] : [],
        receipts: u.lease_id ? receiptsByLease.get(u.lease_id) ?? [] : [],
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
    currency: agencyRow.currency ?? "GNF",
    address: details?.address ?? "",
    email: details?.email ?? "",
    registration: details?.registration ?? "",
  };

  return { agencyId, agencies, agencyInfo, currentUser, buildings, tickets, technicians, activity };
}
