import { initializePayment, isPayunitConfigured, newTransactionId } from "@/lib/payunit";
import { siteUrl } from "@/lib/site-url";
import { json, mobileDb, mobileUser, unauthorized } from "@/lib/mobile";

export const dynamic = "force-dynamic";

/**
 * Opens a PayUnit checkout for the resident: rent (charges of their own
 * lease, plus months ahead) or a short stay they hold. The amount is always
 * computed here from the database, never taken from the app.
 *
 * Body: { kind: "rent" | "stay", method: "mobile_money" | "card",
 *         charge_ids?: string[]  (uuids, or "adv:YYYY-MM-01" for a month ahead),
 *         stay_id?: string }
 * Answer: { reference, amount, checkout_url }
 */
export async function POST(request: Request) {
  const user = await mobileUser(request);
  if (!user) return unauthorized();
  if (!isPayunitConfigured()) return json({ error_key: "err_generic", error: "payunit is not configured" }, 503);

  const body = (await request.json().catch(() => ({}))) as {
    kind?: string;
    method?: string;
    charge_ids?: string[];
    stay_id?: string;
  };
  const method = body.method === "card" ? "card" : "mobile_money";
  const admin = mobileDb();
  const ref = newTransactionId();

  let agencyId: string;
  let currency: string;
  let amount = 0;
  let description: string;
  const row: Record<string, unknown> = { user_id: user.id, method, provider_ref: ref };

  if (body.kind === "stay") {
    const { data: stay } = await admin
      .from("stays")
      .select("id, agency_id, amount, paid, status, hold_expires_at, check_in, check_out, agencies ( currency )")
      .eq("id", body.stay_id ?? "")
      .eq("guest_user_id", user.id)
      .maybeSingle();
    if (!stay || stay.status === "cancelled") return json({ error_key: "err_generic", error: "unknown stay" }, 404);
    if (stay.paid === 0 && stay.hold_expires_at && Date.parse(stay.hold_expires_at) < Date.now()) {
      return json({ error_key: "hold_expired", error: "the hold lapsed, book again" }, 409);
    }
    // Give the checkout time to finish without the hold lapsing under it.
    await admin.from("stays").update({ hold_expires_at: new Date(Date.now() + 20 * 60e3).toISOString() }).eq("id", stay.id).eq("paid", 0);
    agencyId = stay.agency_id;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    currency = (stay as any).agencies?.currency ?? "XAF";
    amount = Number(stay.amount) - Number(stay.paid);
    description = `Stay ${stay.check_in} → ${stay.check_out}`;
    Object.assign(row, { kind: "stay", stay_id: stay.id });
  } else {
    const { data: residents } = await admin.from("residents").select("id").eq("user_id", user.id);
    const { data: lease } = await admin
      .from("leases")
      .select("id, agency_id, rent_amount, agencies ( currency )")
      .in("resident_id", (residents ?? []).map((r) => r.id))
      .eq("status", "active")
      .limit(1)
      .maybeSingle();
    if (!lease) return json({ error_key: "err_generic", error: "no active lease" }, 404);

    const ids = (body.charge_ids ?? []).filter((id) => !id.startsWith("adv:"));
    const advance = (body.charge_ids ?? [])
      .filter((id) => id.startsWith("adv:"))
      .map((id) => id.slice(4))
      .filter((d) => /^\d{4}-\d{2}-01$/.test(d))
      .slice(0, 12);
    const { data: charges } = ids.length
      ? await admin.from("v_charge_status").select("rent_charge_id, balance").eq("lease_id", lease.id).in("rent_charge_id", ids)
      : { data: [] };
    if ((charges ?? []).length !== ids.length) return json({ error_key: "err_generic", error: "unknown charge" }, 400);

    agencyId = lease.agency_id;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    currency = (lease as any).agencies?.currency ?? "XAF";
    amount = (charges ?? []).reduce((s, c) => s + Number(c.balance), 0) + advance.length * Number(lease.rent_amount);
    description = "Rent";
    Object.assign(row, { kind: "rent", lease_id: lease.id, charge_ids: ids, advance_periods: advance });
  }

  if (amount <= 0) return json({ error_key: "err_generic", error: "nothing to pay" }, 400);

  const { error } = await admin.from("resident_payments").insert({ ...row, agency_id: agencyId, amount, currency });
  if (error) return json({ error_key: "err_generic", error: error.message }, 500);

  const site = siteUrl();
  const opened = await initializePayment({
    amount,
    currency,
    transactionId: ref,
    returnUrl: `${site}/api/mobile/pay-return?ref=${ref}`,
    notifyUrl: `${site}/api/payunit/notify`,
    description,
  });
  if (!opened.ok) {
    await admin.from("resident_payments").update({ status: "failed" }).eq("provider_ref", ref);
    return json({ error_key: "err_checkout_open", error: opened.error }, 502);
  }
  return json({ reference: ref, amount, checkout_url: opened.checkoutUrl });
}
