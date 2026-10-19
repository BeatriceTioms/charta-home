import { json, mobileDb, mobileUser, unauthorized } from "@/lib/mobile";

export const dynamic = "force-dynamic";

/**
 * Deletes the signed-in resident's account, as the App Store and Google Play
 * require. The account, its devices and rental requests go; payments, leases,
 * paid stays and tickets stay with the agency, unlinked (see the migration
 * 20261019120000_resident_account_deletion.sql and /delete-account).
 *
 * Agency staff are refused: deleting them here would silently drop their
 * membership, and the agency may have no other owner.
 */
export async function DELETE(request: Request) {
  const user = await mobileUser(request);
  if (!user) return unauthorized();
  const admin = mobileDb();

  const { count } = await admin.from("memberships").select("user_id", { count: "exact", head: true }).eq("user_id", user.id);
  if (count) return json({ error_key: "err_delete_staff", error: "agency accounts are deleted from the dashboard" }, 409);

  const { error: forgetError } = await admin.rpc("forget_resident_user", { target: user.id });
  if (forgetError) return json({ error_key: "err_generic", error: forgetError.message }, 500);

  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) return json({ error_key: "err_generic", error: error.message }, 500);

  return json({ ok: true });
}
