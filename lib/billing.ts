import { createAdminClient } from "@/lib/supabase/server";
import { paymentStatus } from "@/lib/payunit";

/**
 * Turns the gateway's word into an active plan.
 *
 * The one place a payment is settled, used by the notify route and by the
 * settings page when the owner comes back from the checkout. Both are only
 * prompts: this asks PayUnit for the transaction by the id we chose, and
 * settles on that answer. The database function is idempotent, so the two
 * prompts arriving for the same payment extend the period once.
 */
export async function settlePayment(
  input: { providerRef: string } | { paymentId: string }
): Promise<
  | { ok: true; outcome: "paid" | "failed" | "cancelled" | "pending"; plan: string | null; until: string | null }
  | { ok: false; error: string }
> {
  const admin = createAdminClient();
  const query = admin.from("subscription_payments").select("id, provider_ref, status, plan");
  const { data: row } =
    "providerRef" in input
      ? await query.eq("provider_ref", input.providerRef).maybeSingle()
      : await query.eq("id", input.paymentId).maybeSingle();
  if (!row) return { ok: false, error: "unknown payment" };

  // Already settled. Nothing to ask, nothing to change.
  if (row.status !== "initiated") {
    const { data: sub } = await admin
      .from("subscriptions")
      .select("current_period_end")
      .eq("agency_id", (await admin.from("subscription_payments").select("agency_id").eq("id", row.id).single()).data?.agency_id ?? "")
      .maybeSingle();
    return { ok: true, outcome: row.status as "paid" | "failed" | "cancelled", plan: row.plan, until: sub?.current_period_end ?? null };
  }

  const answer = await paymentStatus(row.provider_ref);
  if (!answer.ok) return { ok: false, error: answer.error };
  if (answer.status === "PENDING") return { ok: true, outcome: "pending", plan: row.plan, until: null };

  const final = answer.status === "SUCCESS" ? "paid" : answer.status === "CANCELLED" ? "cancelled" : "failed";
  const { data, error } = await admin.rpc("settle_subscription_payment", {
    payment_id_in: row.id,
    final_status: final,
    raw_in: answer.raw as never,
  });
  if (error) return { ok: false, error: error.message };
  const settled = data?.[0];
  return {
    ok: true,
    outcome: (settled?.outcome ?? final) as "paid" | "failed" | "cancelled",
    plan: settled?.new_plan ?? row.plan,
    until: settled?.active_until ?? null,
  };
}
