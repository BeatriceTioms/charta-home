import { settleResidentPayment } from "@/lib/resident-payments";
import { json, mobileDb, mobileUser, unauthorized } from "@/lib/mobile";

export const dynamic = "force-dynamic";

/** The app polls this while the resident is on PayUnit's page. */
export async function GET(request: Request, { params }: { params: Promise<{ ref: string }> }) {
  const user = await mobileUser(request);
  if (!user) return unauthorized();
  const { ref } = await params;

  const { data: row } = await mobileDb()
    .from("resident_payments")
    .select("user_id")
    .eq("provider_ref", ref)
    .maybeSingle();
  if (!row || row.user_id !== user.id) return json({ error: "unknown payment" }, 404);

  const result = await settleResidentPayment(ref);
  // PayUnit unreachable: say pending, the app keeps asking.
  return json({ status: result.ok ? result.outcome : "pending" });
}
