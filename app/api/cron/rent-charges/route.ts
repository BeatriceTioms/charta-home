import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Generates the current period's rent charge for every active lease.
 * Vercel Cron, nightly. Idempotent: ensure_rent_charge upserts.
 */
export async function GET(request: Request) {
  const secret = request.headers.get("authorization");
  if (secret !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const { data: leases, error } = await supabase
    .from("leases")
    .select("id")
    .eq("status", "active");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const today = new Date().toISOString().slice(0, 10);
  let created = 0;
  const failures: string[] = [];

  for (const lease of leases ?? []) {
    const { error: rpcError } = await supabase.rpc("ensure_rent_charge", {
      target_lease: lease.id,
      period: today,
    });
    if (rpcError) failures.push(`${lease.id}: ${rpcError.message}`);
    else created++;
  }

  return NextResponse.json({ leases: leases?.length ?? 0, created, failures });
}
