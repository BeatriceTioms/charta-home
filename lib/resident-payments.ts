/**
 * Rent and short stays paid from the resident app, through PayUnit.
 *
 * Same rules as subscription payments (lib/billing.ts): the gateway's
 * callback and the app's polling are only prompts; the outcome is what
 * PayUnit answers when asked about our own transaction id, and the database
 * function that records it is idempotent.
 */
import { mobileDb } from "@/lib/mobile";
import { paymentStatus } from "@/lib/payunit";
import { sendEmail } from "@/lib/email";
import { formatMoney } from "@/lib/data";
import { agencyBookingEmail, residentReceiptEmail } from "@/lib/resident-emails";
import { siteUrl } from "@/lib/site-url";

export type Outcome = "paid" | "failed" | "cancelled" | "pending";

export async function settleResidentPayment(providerRef: string): Promise<{ ok: true; outcome: Outcome } | { ok: false; error: string }> {
  const admin = mobileDb();
  const { data: row } = await admin
    .from("resident_payments")
    .select("id, user_id, kind, amount, currency, status, stay_id, agency_id, lease_request_id")
    .eq("provider_ref", providerRef)
    .maybeSingle();
  if (!row) return { ok: false, error: "unknown payment" };
  if (row.status !== "initiated") return { ok: true, outcome: row.status as Outcome };

  const answer = await paymentStatus(providerRef);
  if (!answer.ok) return { ok: false, error: answer.error };
  if (answer.status === "PENDING") return { ok: true, outcome: "pending" };

  const final = answer.status === "SUCCESS" ? "paid" : answer.status === "CANCELLED" ? "cancelled" : "failed";
  const { data: settled, error } = await admin.rpc("settle_resident_payment", {
    payment_ref: providerRef,
    final_status: final,
    raw_in: answer.raw as never,
  });
  if (error) return { ok: false, error: error.message };

  // The receipt, through Resend. Only on the transition to paid, so a second
  // prompt for the same payment does not send it twice.
  // The payer may have deleted their account meanwhile (user_id is then null).
  if (settled === "paid" && row.status === "initiated" && row.user_id) {
    const { data: u } = await admin.auth.admin.getUserById(row.user_id);
    const { data: agency } = await admin.from("agencies").select("name, locale").eq("id", row.agency_id).single();
    if (u.user?.email) {
      const sent = await sendEmail({
        to: u.user.email,
        ...residentReceiptEmail({
          locale: agency?.locale ?? "fr",
          agency: agency?.name ?? "Charta Home",
          kind: row.kind as "rent" | "stay" | "booking",
          amount: formatMoney(Number(row.amount), row.currency),
          reference: providerRef,
        }),
      });
      if (!sent.ok) console.error("resident receipt failed:", sent.error);
    }
  }
  if (settled === "paid" && row.status === "initiated" && row.kind === "booking" && row.lease_request_id) {
    await tellAgencyAboutBooking(row.lease_request_id, row.agency_id, formatMoney(Number(row.amount), row.currency));
  }
  return { ok: true, outcome: (settled as Outcome) ?? final };
}

/**
 * The agency hears about a paid booking straight away: at its own address
 * and at its owners'. A failed email never undoes the payment.
 */
async function tellAgencyAboutBooking(requestId: string, agencyId: string, amount: string) {
  const admin = mobileDb();
  const { data: req } = await admin
    .from("lease_requests")
    .select("move_in, months, contact_name, contact_email, contact_phone, apartments ( label, buildings ( name ) )")
    .eq("id", requestId)
    .maybeSingle();
  const { data: agency } = await admin.from("agencies").select("email, locale").eq("id", agencyId).maybeSingle();
  if (!req) return;
  const { data: owners } = await admin.from("memberships").select("user_id").eq("agency_id", agencyId).eq("role", "owner");
  const to = new Set<string>();
  if (agency?.email) to.add(String(agency.email).toLowerCase());
  for (const o of owners ?? []) {
    const { data: u } = await admin.auth.admin.getUserById(o.user_id);
    if (u.user?.email) to.add(u.user.email.toLowerCase());
  }
  const locale = agency?.locale === "en" ? "en" : "fr";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ap = (req as any).apartments ?? {};
  const message = agencyBookingEmail({
    locale,
    unit: [ap.buildings?.name, ap.label].filter(Boolean).join(" · "),
    name: req.contact_name || req.contact_email || "—",
    email: req.contact_email ?? "—",
    phone: req.contact_phone ?? "",
    moveIn: new Date(`${req.move_in}T12:00:00Z`).toLocaleDateString(locale === "fr" ? "fr-FR" : "en-GB", { dateStyle: "long" }),
    months: req.months,
    amount,
    dashboardUrl: `${siteUrl()}/${locale}/dashboard`,
  });
  for (const address of to) {
    const sent = await sendEmail({ to: address, ...message });
    if (!sent.ok) console.error(`booking email to ${address} failed:`, sent.error);
  }
}
