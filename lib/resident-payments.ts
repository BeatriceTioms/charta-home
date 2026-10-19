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
import { residentReceiptEmail } from "@/lib/resident-emails";

export type Outcome = "paid" | "failed" | "cancelled" | "pending";

export async function settleResidentPayment(providerRef: string): Promise<{ ok: true; outcome: Outcome } | { ok: false; error: string }> {
  const admin = mobileDb();
  const { data: row } = await admin
    .from("resident_payments")
    .select("id, user_id, kind, amount, currency, status, stay_id, agency_id")
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
  if (settled === "paid" && row.status === "initiated") {
    const { data: u } = await admin.auth.admin.getUserById(row.user_id);
    const { data: agency } = await admin.from("agencies").select("name, locale").eq("id", row.agency_id).single();
    if (u.user?.email) {
      const sent = await sendEmail({
        to: u.user.email,
        ...residentReceiptEmail({
          locale: agency?.locale ?? "fr",
          agency: agency?.name ?? "Charta Home",
          kind: row.kind as "rent" | "stay",
          amount: formatMoney(Number(row.amount), row.currency),
          reference: providerRef,
        }),
      });
      if (!sent.ok) console.error("resident receipt failed:", sent.error);
    }
  }
  return { ok: true, outcome: (settled as Outcome) ?? final };
}
