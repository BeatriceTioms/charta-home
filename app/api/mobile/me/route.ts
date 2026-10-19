import { json, listingSelect, mobileDb, mobileUser, signedUrls, toListing, unauthorized } from "@/lib/mobile";

export const dynamic = "force-dynamic";

/**
 * Everything the app shows a signed-in resident, in one call: their home and
 * lease, rent charges and payments, repairs and short stays. Read with the
 * service role but always through this user's own resident rows.
 */
export async function GET(request: Request) {
  const user = await mobileUser(request);
  if (!user) return unauthorized();
  const admin = mobileDb();

  const { data: residents } = await admin.from("residents").select("id, full_name, phone_e164, email").eq("user_id", user.id);
  const residentIds = (residents ?? []).map((r) => r.id);

  const { data: lease } = residentIds.length
    ? await admin
        .from("leases")
        .select("id, apartment_id, starts_on, ends_on, rent_amount, cycle, due_day, deposit, agencies ( currency )")
        .in("resident_id", residentIds)
        .eq("status", "active")
        .order("starts_on", { ascending: false })
        .limit(1)
        .maybeSingle()
    : { data: null };

  let leaseJson = null;
  let charges: unknown[] = [];
  let payments: unknown[] = [];
  if (lease) {
    const { data: apartment } = await admin.from("apartments").select(listingSelect).eq("id", lease.apartment_id).single();
    leaseJson = {
      id: lease.id,
      unit: apartment?.label ?? "",
      starts_on: lease.starts_on,
      ends_on: lease.ends_on,
      rent: lease.rent_amount,
      cycle: lease.cycle,
      due_day: lease.due_day,
      deposit: lease.deposit,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      currency: (lease as any).agencies?.currency ?? "XAF",
      property: apartment ? await toListing(apartment) : null,
    };
    const { data: cs } = await admin
      .from("v_charge_status")
      .select("rent_charge_id, period_start, period_end, due_on, amount, paid_amount, state")
      .eq("lease_id", lease.id)
      .neq("state", "void")
      .order("period_start");
    charges = (cs ?? []).map((c) => ({
      id: c.rent_charge_id,
      period_start: c.period_start,
      period_end: c.period_end,
      due_on: c.due_on,
      amount: c.amount,
      paid: c.paid_amount,
    }));
    const { data: ps } = await admin
      .from("payments")
      .select("id, amount, paid_on, method, reference, payment_allocations ( rent_charges ( period_start ) )")
      .eq("lease_id", lease.id)
      .order("paid_on", { ascending: false });
    payments = (ps ?? []).map((p) => ({
      id: p.id,
      amount: p.amount,
      paid_on: p.paid_on,
      method: p.method,
      reference: p.reference ?? "",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      periods: (p.payment_allocations ?? []).map((a: any) => a.rent_charges?.period_start).filter(Boolean),
    }));
  }

  const { data: ts } = residentIds.length
    ? await admin
        .from("tickets")
        .select(
          "id, number, title, description, category, priority, status, opened_at, resolved_at, location, rating, photo_paths, technicians ( full_name, trade, phone_e164 ), ticket_messages ( direction, body, created_at )"
        )
        .in("resident_id", residentIds)
        .order("opened_at", { ascending: false })
    : { data: [] };
  const tickets = await Promise.all(
    (ts ?? []).map(async (t) => ({
      id: t.id,
      number: t.number,
      title: t.title,
      description: t.description,
      category: t.category,
      priority: t.priority,
      status: t.status,
      opened_at: t.opened_at,
      resolved_at: t.resolved_at,
      location: t.location,
      rating: t.rating,
      photos: await signedUrls("ticket-photos", t.photo_paths ?? []),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      technician: (t as any).technicians
        ? {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            name: (t as any).technicians.full_name,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            trade: (t as any).technicians.trade ?? "",
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            phone: (t as any).technicians.phone_e164 ?? "",
          }
        : null,
      messages: (t.ticket_messages ?? [])
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .sort((a: any, b: any) => a.created_at.localeCompare(b.created_at))
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((m: any) => ({ from_me: m.direction === "inbound", body: m.body ?? "", at: m.created_at })),
    }))
  );

  const { data: ss } = await admin
    .from("stays")
    .select(`id, check_in, check_out, amount, paid, status, apartments ( ${listingSelect} )`)
    .eq("guest_user_id", user.id)
    .gt("paid", 0)
    .neq("status", "cancelled")
    .order("check_in");
  const stays = await Promise.all(
    (ss ?? []).map(async (s) => ({
      id: s.id,
      check_in: s.check_in,
      nights: Math.round((Date.parse(s.check_out) - Date.parse(s.check_in)) / 864e5),
      total: s.amount,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      property: await toListing((s as any).apartments),
    }))
  );

  const resident = residents?.[0];
  return json({
    user: {
      name: resident?.full_name ?? user.name,
      phone: resident?.phone_e164 ?? user.phone ?? "",
      email: user.email ?? resident?.email ?? "",
      photo: "",
    },
    lease: leaseJson,
    charges,
    payments,
    tickets,
    notices: [],
    stays,
  });
}
