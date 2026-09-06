"use server";

import { revalidatePath } from "next/cache";
import { isEmailConfigured, planCodeEmail, sendEmail } from "@/lib/email";
import { isPlanCode, planName, type BillingCycle } from "@/lib/pricing";
import { siteUrl } from "@/lib/site-url";
import { createClient } from "./server";
import type { AdminAgencyDetail, AdminAgencyRow, AdminSubscriptionRow } from "./types";

/**
 * The platform desk's writes. Every one goes through a function that refuses
 * anybody not in platform_admins, so nothing here decides who may act; it
 * only carries the request and shapes the answer.
 */

export async function listAgencies(): Promise<AdminAgencyRow[] | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_list_agencies");
  if (error) return null;
  return (data ?? []) as AdminAgencyRow[];
}

export async function listSubscriptions(): Promise<AdminSubscriptionRow[] | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_list_subscriptions");
  if (error) return null;
  return (data ?? []) as AdminSubscriptionRow[];
}

/**
 * Who is sitting at the desk. Staff are not agencies, so most have no
 * dashboard to go back to; the frame offers that link only to one who does.
 */
export async function adminIdentity(): Promise<{ email: string; hasAgency: boolean }> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const { count } = await supabase
    .from("memberships")
    .select("agency_id", { count: "exact", head: true })
    .eq("user_id", auth.user?.id ?? "");
  return { email: auth.user?.email ?? "", hasAgency: (count ?? 0) > 0 };
}

export async function agencyDetail(agencyId: string): Promise<AdminAgencyDetail | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_agency_detail", { target_agency: agencyId });
  if (error || !data) return null;
  return data as AdminAgencyDetail;
}

export async function issuePlanCode(
  locale: string,
  input: { agencyId: string; plan: string; cycle: string }
): Promise<{ ok: true; code: string; validUntil: string } | { ok: false; error: string }> {
  if (!isPlanCode(input.plan)) return { ok: false, error: "unknown plan" };
  const cycle: BillingCycle = input.cycle === "annual" ? "annual" : "monthly";

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_issue_plan_code", {
    target_agency: input.agencyId,
    plan_code: input.plan,
    cycle_in: cycle,
  });
  if (error) return { ok: false, error: error.message };
  const row = data?.[0];
  if (!row) return { ok: false, error: "no code returned" };
  revalidatePath(`/${locale}/admin`);
  return { ok: true, code: row.issued_code, validUntil: row.valid_until };
}

/**
 * Sends the open code to the agency's owner.
 *
 * The address is read back from the desk's own listing rather than taken
 * from the form, so a code can only ever go to the owner on record.
 */
export async function emailPlanCode(
  locale: string,
  input: { agencyId: string; code: string; validUntil: string; plan: string; cycle: string }
): Promise<{ ok: true; to: string } | { ok: false; error: string }> {
  if (!isPlanCode(input.plan)) return { ok: false, error: "unknown plan" };
  if (!isEmailConfigured()) return { ok: false, error: "email is not configured" };

  const rows = await listAgencies();
  const agency = rows?.find((r) => r.agency_id === input.agencyId);
  if (!agency) return { ok: false, error: "not a platform admin, or no such agency" };
  if (!agency.owner_email) return { ok: false, error: "this agency has no owner email" };

  const fr = locale === "fr";
  const tag = fr ? "fr-FR" : "en-GB";
  const message = planCodeEmail({
    agencyName: agency.agency_name,
    ownerName: agency.owner_name || agency.owner_email.split("@")[0],
    code: input.code,
    planLabel: planName(input.plan, locale),
    cycleLabel: input.cycle === "annual" ? (fr ? "annuel" : "yearly") : fr ? "mensuel" : "monthly",
    validUntil: new Date(input.validUntil).toLocaleString(tag, { dateStyle: "long", timeStyle: "short" }),
    settingsUrl: `${siteUrl()}/${locale}/dashboard/settings`,
    locale,
  });
  const sent = await sendEmail({ to: agency.owner_email, ...message });
  if (!sent.ok) return { ok: false, error: sent.error };
  return { ok: true, to: agency.owner_email };
}
